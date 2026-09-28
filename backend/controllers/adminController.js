const User = require('../models/User');
const LostItem = require('../models/LostItem');
const FoundItem = require('../models/FoundItem');
const Match = require('../models/Match');
const Claim = require('../models/Claim');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { sendSuccess } = require('../utils/apiResponse');
const { createAndSendNotification } = require('../services/socketService');
const { getRewardLevel, getPointsForCategory } = require('../services/rewardService');
const RewardHistory = require('../models/RewardHistory');
const { sendClaimStatusEmail, sendRewardEarnedEmail } = require('../utils/emailService');
const { assertValidObjectId } = require('../middleware/validate');

// ─────────────────────────────────────────────────────────────────────
// Shared helper: award finder reward exactly once (atomic).
// Phase 2: extracted from markMatchReturned so BOTH the Match return
// path and the new Claim return path reuse the SAME canonical logic —
// no second reward implementation.
// rewardFn must perform the single conditional update that claims the
// "already rewarded" flag atomically; it resolves truthy when this
// request won the right to award, or null when a concurrent request
// already did. Never throws on the duplicate case — it returns null so
// the caller can log and continue.
// ─────────────────────────────────────────────────────────────────────
const awardFinderRewardOnce = async ({ finderId, category, rewardFn, reasonPrefix }) => {
  const finderUser = await User.findById(finderId);
  if (!finderUser) {
    console.error(`[Reward] Finder user ${finderId} not found — reward not awarded.`);
    return null;
  }

  // ATOMIC double-award guard (pattern from the Phase 0 fix on the Match
  // path): claim the "already rewarded" flag with a conditional update
  // FIRST. Only the request whose update actually matches (flag still
  // false) may award points. Two rapid invocations can no longer both
  // pass a plain in-memory flag check.
  const claimed = await rewardFn();
  if (!claimed) {
    // Another concurrent request already rewarded this return.
    console.warn(`[Reward] ${reasonPrefix} ${category} was already rewarded — skipping duplicate award.`);
    return null;
  }

  const pointsToAward = await getPointsForCategory(category);

  finderUser.rewardPoints += pointsToAward;
  finderUser.itemsReturned += 1;
  finderUser.rewardLevel = getRewardLevel(finderUser.rewardPoints);
  await finderUser.save();

  await RewardHistory.create({
    user: finderId,
    points: pointsToAward,
    type: 'earned',
    reason: `Successfully returned a ${category}`,
  });

  // Send reward earned email (non-blocking, fire-and-forget). Email is not
  // a project feature (no SMTP configured) but the call is kept harmless.
  sendRewardEarnedEmail({
    userEmail: finderUser.email,
    userName: finderUser.name,
    rewardType: `Successfully returned a ${category}`,
    pointsEarned: pointsToAward,
    rewardLevel: finderUser.rewardLevel,
  }).catch((emailErr) => {
    console.error('[Reward] Failed to send reward-earned email:', {
      to: finderUser.email,
      finderId,
      points: pointsToAward,
      code: emailErr.code,
      message: emailErr.message,
    });
  });

  return { pointsToAward, finderUser };
};

// @desc    Get all registered users (with contact info visible to admin)
// @route   GET /api/admin/users
// @access  Private/Admin
const getAllUsers = asyncHandler(async (req, res) => {
  const users = await User.find()
    .select('+fullName +profileEmail +mobileNumber')
    .sort({ createdAt: -1 });
  sendSuccess(res, 200, 'Users fetched successfully', { users });
});

// @desc    Get every lost item report (with private fields visible to admin)
// @route   GET /api/admin/lost
// @access  Private/Admin
const getAllLostItemsAdmin = asyncHandler(async (req, res) => {
  const lostItems = await LostItem.find()
    .populate('user', 'name email')
    .select('+uniqueMarks +ownershipDetails')
    .sort({ createdAt: -1 });
  sendSuccess(res, 200, 'Lost items fetched successfully', { lostItems });
});

// @desc    Get every found item report (with private fields visible to admin)
// @route   GET /api/admin/found
// @access  Private/Admin
const getAllFoundItemsAdmin = asyncHandler(async (req, res) => {
  const foundItems = await FoundItem.find()
    .populate('user', 'name email')
    .select('+uniqueMarks +additionalObservations')
    .sort({ createdAt: -1 });
  sendSuccess(res, 200, 'Found items fetched successfully', { foundItems });
});

// @desc    Get every match record (admin review queue)
//          Populates both items with their private fields for side-by-side comparison
// @route   GET /api/admin/matches
// @access  Private/Admin
const getAllMatchesAdmin = asyncHandler(async (req, res) => {
  const matches = await Match.find()
    .populate({
      path: 'lostItem',
      select: '+uniqueMarks +ownershipDetails',
      populate: { path: 'user', select: 'name email +fullName +profileEmail +mobileNumber' },
    })
    .populate({
      path: 'foundItem',
      select: '+uniqueMarks +additionalObservations',
      populate: { path: 'user', select: 'name email' },
    })
    .sort({ score: -1, imageSimilarityScore: -1 });

  sendSuccess(res, 200, 'Matches fetched successfully', { matches });
});

// @desc    Get a single match by ID (for detailed admin review)
// @route   GET /api/admin/match/:id
// @access  Private/Admin
const getMatchByIdAdmin = asyncHandler(async (req, res) => {
  const match = await Match.findById(req.params.id)
    .populate({
      path: 'lostItem',
      select: '+uniqueMarks +ownershipDetails',
      populate: { path: 'user', select: 'name email +fullName +profileEmail +mobileNumber' },
    })
    .populate({
      path: 'foundItem',
      select: '+uniqueMarks +additionalObservations',
      populate: { path: 'user', select: 'name email' },
    });

  if (!match) {
    throw new ApiError(404, 'Match not found');
  }

  sendSuccess(res, 200, 'Match fetched successfully', { match });
});

// @desc    Verify a match — confirms the algorithm suggestion is a real match
// @route   PUT /api/admin/match/:id/verify
// @access  Private/Admin
const verifyMatch = asyncHandler(async (req, res) => {
  const match = await Match.findById(req.params.id);

  if (!match) {
    throw new ApiError(404, 'Match not found');
  }

  if (match.status === 'Returned') {
    throw new ApiError(400, 'This match has already been returned');
  }

  match.status = 'Verified';
  await match.save();

  // Propagate status to both underlying items
  await Promise.all([
    LostItem.findByIdAndUpdate(match.lostItem, { status: 'Verified' }),
    FoundItem.findByIdAndUpdate(match.foundItem, { status: 'Verified' }),
  ]);

  const updatedMatch = await Match.findById(match._id)
    .populate({ path: 'lostItem', populate: { path: 'user', select: 'name email' } })
    .populate({ path: 'foundItem', populate: { path: 'user', select: 'name email' } });

  // Notify the owner of the lost item their match was verified
  const lostOwnerId = updatedMatch.lostItem?.user?._id;
  const foundOwnerId = updatedMatch.foundItem?.user?._id;
  if (lostOwnerId) {
    createAndSendNotification({
      title: '\u2705 Match Verified by Admin',
      message: `Your match for "${updatedMatch.lostItem.itemType || updatedMatch.lostItem.category}" has been verified. Please contact the finder to collect your item.`,
      notificationType: 'claim_approved',
      userId: lostOwnerId,
      relatedMatch: updatedMatch._id,
      priority: 'high',
    }).catch((e) => console.error('[Notification] verifyMatch lost owner:', e.message));
  }
  if (foundOwnerId) {
    createAndSendNotification({
      title: '\u2705 Match Verified',
      message: `The match for the item you found has been verified by an admin. Please arrange the handover.`,
      notificationType: 'claim_approved',
      userId: foundOwnerId,
      relatedMatch: updatedMatch._id,
      priority: 'high',
    }).catch((e) => console.error('[Notification] verifyMatch found owner:', e.message));
  }

  sendSuccess(res, 200, 'Match verified successfully', { match: updatedMatch });
});

// @desc    Reject a match — admin confirms these are NOT the same item
// @route   PUT /api/admin/match/:id/reject
// @access  Private/Admin
const rejectMatch = asyncHandler(async (req, res) => {
  const match = await Match.findById(req.params.id);

  if (!match) {
    throw new ApiError(404, 'Match not found');
  }

  if (match.status === 'Returned') {
    throw new ApiError(400, 'This match has already been returned and cannot be rejected');
  }

  match.status = 'Rejected';
  await match.save();

  // Reset items back to Pending (they are back in the pool for new matches)
  await Promise.all([
    LostItem.findByIdAndUpdate(match.lostItem, { status: 'Pending' }),
    FoundItem.findByIdAndUpdate(match.foundItem, { status: 'Pending' }),
  ]);

  const updatedMatch = await Match.findById(match._id)
    .populate({ path: 'lostItem', populate: { path: 'user', select: 'name email' } })
    .populate({ path: 'foundItem', populate: { path: 'user', select: 'name email' } });

  // Notify both parties that match was rejected
  const lostOwnerIdR = updatedMatch.lostItem?.user?._id;
  const foundOwnerIdR = updatedMatch.foundItem?.user?._id;
  if (lostOwnerIdR) {
    createAndSendNotification({
      title: '\u274c Match Rejected by Admin',
      message: `The AI match suggestion for your "${updatedMatch.lostItem.itemType || updatedMatch.lostItem.category}" was rejected by an admin. We\'ll keep searching for a better match.`,
      notificationType: 'claim_rejected',
      userId: lostOwnerIdR,
      relatedMatch: updatedMatch._id,
      priority: 'medium',
    }).catch((e) => console.error('[Notification] rejectMatch lost owner:', e.message));
  }
  if (foundOwnerIdR) {
    createAndSendNotification({
      title: '\u274c Match Rejected',
      message: `The match suggestion for the item you found was rejected. The item remains in the pool for future matches.`,
      notificationType: 'claim_rejected',
      userId: foundOwnerIdR,
      relatedMatch: updatedMatch._id,
      priority: 'low',
    }).catch((e) => console.error('[Notification] rejectMatch found owner:', e.message));
  }

  sendSuccess(res, 200, 'Match rejected', { match: updatedMatch });
});

// @desc    Mark a match as Returned — item physically handed back to owner
//          Requires the match to already be Verified
// @route   PUT /api/admin/match/:id/returned
// @access  Private/Admin
const markMatchReturned = asyncHandler(async (req, res) => {
  const match = await Match.findById(req.params.id);

  if (!match) {
    throw new ApiError(404, 'Match not found');
  }

  if (match.status !== 'Verified') {
    throw new ApiError(400, 'A match must be Verified before it can be marked as Returned');
  }

  match.status = 'Returned';
  await match.save();

  // Propagate Returned status to both items
  await Promise.all([
    LostItem.findByIdAndUpdate(match.lostItem, { status: 'Returned' }),
    FoundItem.findByIdAndUpdate(match.foundItem, { status: 'Returned' }),
  ]);

  const updatedMatch = await Match.findById(match._id)
    .populate({ path: 'lostItem', select: '+uniqueMarks +ownershipDetails', populate: { path: 'user', select: 'name email +fullName +profileEmail +mobileNumber' } })
    .populate({ path: 'foundItem', select: '+uniqueMarks +additionalObservations', populate: { path: 'user', select: 'name email' } });

  // --- Reward Points Logic ---
  // Finder = the user who reported the found item (authoritative DB
  // relationship — never the request body). Owner never gets the reward.
  const finderIdStr = updatedMatch.foundItem?.user?._id?.toString();
  const loserIdStr = updatedMatch.lostItem?.user?._id?.toString() || updatedMatch.lostItem?.user?.toString();

  const isSelfMatch = finderIdStr && loserIdStr && finderIdStr === loserIdStr;

  if (updatedMatch.foundItem && updatedMatch.foundItem.user && !isSelfMatch) {
    const finderId = updatedMatch.foundItem.user._id;
    const category = updatedMatch.foundItem.category;

    // Shared canonical reward logic (atomic double-award guard inside).
    const rewardResult = await awardFinderRewardOnce({
      finderId,
      category,
      reasonPrefix: `Match ${match._id}`,
      rewardFn: () =>
        Match.findOneAndUpdate(
          { _id: match._id, isRewarded: false },
          { $set: { isRewarded: true } },
          { new: true }
        ),
    });

    if (rewardResult) {
      // Keep the in-memory doc consistent with the database.
      match.isRewarded = true;
    }
  }

  // Notify both parties that item is returned
  const lostOwnerIdRet = updatedMatch.lostItem?.user?._id;
  const foundOwnerIdRet = updatedMatch.foundItem?.user?._id;
  if (lostOwnerIdRet) {
    createAndSendNotification({
      title: '\ud83c\udf89 Item Successfully Returned!',
      message: `Great news! Your "${updatedMatch.lostItem.itemType || updatedMatch.lostItem.category}" has been successfully returned. Thank you for using Lost & Found!`,
      notificationType: 'returned',
      userId: lostOwnerIdRet,
      relatedMatch: updatedMatch._id,
      priority: 'high',
    }).catch((e) => console.error('[Notification] markReturned lost owner:', e.message));
  }
  if (foundOwnerIdRet) {
    createAndSendNotification({
      title: '\ud83d Item Returned to Owner',
      message: `The item you found has been successfully returned to its owner. Thank you for your honesty! You earned points.`,
      notificationType: 'returned',
      userId: foundOwnerIdRet,
      relatedMatch: updatedMatch._id,
      priority: 'medium',
    }).catch((e) => console.error('[Notification] markReturned found owner:', e.message));
  }
  // Notify admins too
  createAndSendNotification({
    title: '\ud83d Item Successfully Returned',
    message: `Match resolved: "${updatedMatch.lostItem?.itemType}" returned to ${updatedMatch.lostItem?.user?.name}.`,
    notificationType: 'item_returned',
    isAdminNotification: true,
    relatedMatch: updatedMatch._id,
    priority: 'low',
  }).catch((e) => console.error('[Notification] markReturned admin:', e.message));

  sendSuccess(res, 200, 'Match marked as returned', { match: updatedMatch });
});

// @desc    Delete a lost item report (admin)
// @route   DELETE /api/admin/lost/:id
// @access  Private/Admin
const deleteLostItemAdmin = asyncHandler(async (req, res) => {
  const lostItem = await LostItem.findById(req.params.id);

  if (!lostItem) {
    throw new ApiError(404, 'Lost item not found');
  }

  await lostItem.deleteOne();
  await Match.deleteMany({ lostItem: lostItem._id });

  sendSuccess(res, 200, 'Lost item deleted successfully', {});
});

// @desc    Delete a found item report (admin)
// @route   DELETE /api/admin/found/:id
// @access  Private/Admin
const deleteFoundItemAdmin = asyncHandler(async (req, res) => {
  const foundItem = await FoundItem.findById(req.params.id);

  if (!foundItem) {
    throw new ApiError(404, 'Found item not found');
  }

  await foundItem.deleteOne();
  await Match.deleteMany({ foundItem: foundItem._id });

  sendSuccess(res, 200, 'Found item deleted successfully', {});
});

// @desc    Get all claim requests (admin review)
// @route   GET /api/admin/claims
// @access  Private/Admin
const getAllClaimsAdmin = asyncHandler(async (req, res) => {
  const claims = await Claim.find()
    .populate('user', 'name email')
    .populate('foundItem', 'itemType category location dateFound image')
    .populate('lostItem', 'itemType category location dateLost image')
    .sort({ createdAt: -1 });
  sendSuccess(res, 200, 'Claims fetched successfully', { claims });
});

// @desc    Verify or reject a claim
// @route   PUT /api/admin/claim/:id/verify
// @route   PUT /api/admin/claim/:id/reject
// @access  Private/Admin
const updateClaimStatus = asyncHandler(async (req, res) => {
  const { action } = req.params; // 'verify' or 'reject'
  const claim = await Claim.findById(req.params.id);

  if (!claim) {
    throw new ApiError(404, 'Claim not found');
  }

  if (claim.status === 'returned') {
    throw new ApiError(400, 'This claim has already been returned and its status can no longer change');
  }

  if (action === 'verify') {
    if (claim.status !== 'pending') {
      throw new ApiError(400, `Only a pending claim can be verified (current status: ${claim.status})`);
    }
    claim.status = 'verified';
    await FoundItem.findByIdAndUpdate(claim.foundItem, { status: 'Verified' });
    if (claim.lostItem) {
      await LostItem.findByIdAndUpdate(claim.lostItem, { status: 'Verified' });
    }
  } else if (action === 'reject') {
    if (claim.status !== 'pending') {
      throw new ApiError(400, `Only a pending claim can be rejected (current status: ${claim.status})`);
    }
    claim.status = 'rejected';
  } else {
    throw new ApiError(400, 'Invalid action');
  }

  await claim.save();

  const updatedClaim = await Claim.findById(claim._id)
    .populate('user', 'name email')
    .populate('foundItem', 'itemType category location')
    .populate('lostItem', 'itemType category location');

  // Notify the claim submitter
  if (updatedClaim.user?._id) {
    const isVerified = action === 'verify';
    createAndSendNotification({
      title: isVerified ? '\u2705 Claim Approved' : '\u274c Claim Rejected',
      message: isVerified
        ? `Your claim for "${updatedClaim.foundItem?.itemType || updatedClaim.foundItem?.category}" has been approved by an admin. Please proceed to collect your item.`
        : `Your claim for "${updatedClaim.foundItem?.itemType || updatedClaim.foundItem?.category}" was reviewed and rejected. Contact support if you believe this is incorrect.`,
      notificationType: isVerified ? 'claim_approved' : 'claim_rejected',
      userId: updatedClaim.user._id,
      priority: 'high',
    }).catch((e) => console.error('[Notification] updateClaimStatus:', e.message));

    // Send claim status email (non-blocking, fire-and-forget)
    sendClaimStatusEmail({
      userEmail: updatedClaim.user.email,
      userName: updatedClaim.user.name,
      itemTitle: updatedClaim.foundItem?.itemType || updatedClaim.foundItem?.category || 'item',
      claimStatus: action === 'verify' ? 'approved' : 'rejected',
      statusMessage: action === 'verify'
        ? 'Please proceed to collect your item or contact support for handover details.'
        : 'If you believe this decision is incorrect, please contact support with additional proof of ownership.',
    }).catch((emailErr) => {
      console.error('[Admin] Failed to send claim-status email:', {
        to: updatedClaim.user.email,
        claimId: claim._id,
        action,
        code: emailErr.code,
        message: emailErr.message,
      });
    });
  }

  sendSuccess(res, 200, `Claim ${action}ed successfully`, { claim: updatedClaim });
});

// @desc    Mark a verified claim as Returned — the physical handover happened.
//          This completes the claim lifecycle: claim → verified → returned,
//          and awards the FINDER (found-item reporter) their reward exactly
//          once. Direct claims (no LostItem) are fully supported.
// @route   PATCH /api/admin/claim/:id/return
// @access  Private/Admin
const markClaimReturned = asyncHandler(async (req, res) => {
  // 1. Validate claim ID (clean 400 on malformed ids, no stack traces).
  assertValidObjectId(req.params.id, 'Claim ID');

  // 2-3. Load the claim and verify it exists.
  const claim = await Claim.findById(req.params.id);
  if (!claim) {
    throw new ApiError(404, 'Claim not found');
  }

  // 4. Only a verified claim can be returned — rejects pending → returned
  //    and rejected → returned.
  if (claim.status === 'returned') {
    throw new ApiError(400, 'This claim has already been marked as returned');
  }
  if (claim.status !== 'verified') {
    throw new ApiError(400, `A claim must be Verified before it can be marked as Returned (current status: ${claim.status})`);
  }

  // 5. FINDER — derived ONLY from the database relationship: the user who
  //    reported the found item. Never from the request body, the admin,
  //    or the claimant.
  const foundItem = await FoundItem.findById(claim.foundItem).populate('user', 'name email');
  if (!foundItem || !foundItem.user) {
    throw new ApiError(404, 'Found item or finder not found for this claim');
  }
  const finderId = foundItem.user._id;

  // 6. OWNER — the claimant (the user who submitted this claim). For linked
  //    claims this is the lost-item reporter; for direct claims it is simply
  //    the owner who claimed. Never trusted from the request body.
  const ownerId = claim.user;

  // 7. Self-reward protection: if owner and finder are the same user, the
  //    item is handed back but NO finder reward is awarded.
  const isSelfReward = String(finderId) === String(ownerId);

  // 8. Transition claim → returned (guard happens before any reward).
  claim.status = 'returned';
  await claim.save();

  // 9. Keep item state consistent — mirrors the Match-path behavior
  //    (verifyMatch sets Verified, markMatchReturned sets Returned).
  await Promise.all([
    FoundItem.findByIdAndUpdate(claim.foundItem, { status: 'Returned' }),
    claim.lostItem ? LostItem.findByIdAndUpdate(claim.lostItem, { status: 'Returned' }) : Promise.resolve(),
  ]);

  // 10. Match synchronization: if this claim created/linked a Match record,
  //     keep it in the SAME returned state and use the SAME atomic
  //     isRewarded flag so the reward can never be paid once via the claim
  //     path and again via the match path.
  let linkedMatch = null;
  if (claim.lostItem) {
    linkedMatch = await Match.findOne({ lostItem: claim.lostItem, foundItem: claim.foundItem });
    if (linkedMatch && linkedMatch.status !== 'Returned') {
      linkedMatch.status = 'Returned';
      await linkedMatch.save();
      await LostItem.findByIdAndUpdate(claim.lostItem, { status: 'Returned' });
    }
  }

  // 11. Award finder reward exactly once (shared canonical logic).
  let rewardInfo = null;
  if (!isSelfReward) {
    const rewardFn = linkedMatch
      ? () =>
          Match.findOneAndUpdate(
            { _id: linkedMatch._id, isRewarded: false },
            { $set: { isRewarded: true } },
            { new: true }
          )
      : () =>
          Claim.findOneAndUpdate(
            { _id: claim._id, rewardGranted: false },
            { $set: { rewardGranted: true } },
            { new: true }
          );

    rewardInfo = await awardFinderRewardOnce({
      finderId,
      category: foundItem.category,
      reasonPrefix: `Claim ${claim._id}`,
      rewardFn,
    });
  } else {
    console.warn(`[Admin] Claim ${claim._id}: owner and finder are the same user — finder reward NOT awarded.`);
  }

  // 12. Notifications (in-app only; no email is sent for this action).
  const itemName = foundItem.itemType || foundItem.category || 'item';
  const ownerUser = await User.findById(ownerId).select('name');

  createAndSendNotification({
    title: '\ud83c\udf89 Item Successfully Returned!',
    message: `Your claim for "${itemName}" has been completed — the item has been returned to you. Thank you for using Lost & Found!`,
    notificationType: 'returned',
    userId: ownerId,
    relatedItem: claim.foundItem,
    itemModel: 'FoundItem',
    priority: 'high',
  }).catch((e) => console.error('[Notification] claimReturned owner:', e.message));

  if (!isSelfReward) {
    createAndSendNotification({
      title: rewardInfo ? `\ud83c\udfc1 You earned ${rewardInfo.pointsToAward} reward points!` : '\ud83d\udcdc Item Returned to Owner',
      message: rewardInfo
        ? `The "${itemName}" you found has been successfully returned to its owner. You earned ${rewardInfo.pointsToAward} reward points for your honesty!`
        : `The "${itemName}" you found has been successfully returned to its owner. Thank you for your honesty!`,
      notificationType: 'returned',
      userId: finderId,
      relatedItem: claim.foundItem,
      itemModel: 'FoundItem',
      priority: 'medium',
    }).catch((e) => console.error('[Notification] claimReturned finder:', e.message));
  }

  createAndSendNotification({
    title: '\ud83d\udce6 Claim Completed — Item Returned',
    message: `Claim resolved: "${itemName}" returned to ${ownerUser?.name || 'the owner'}.`,
    notificationType: 'item_returned',
    isAdminNotification: true,
    relatedItem: claim.foundItem,
    itemModel: 'FoundItem',
    priority: 'low',
  }).catch((e) => console.error('[Notification] claimReturned admin:', e.message));

  // 13. Clear response with the final state.
  const updatedClaim = await Claim.findById(claim._id)
    .populate('user', 'name email')
    .populate('foundItem', 'itemType category location status')
    .populate('lostItem', 'itemType category location status');

  sendSuccess(res, 200, 'Claim marked as returned successfully', {
    claim: updatedClaim,
    rewardAwarded: Boolean(rewardInfo),
    rewardPoints: rewardInfo ? rewardInfo.pointsToAward : 0,
  });
});

// @desc    Get platform-wide statistics for the admin dashboard
// @route   GET /api/admin/stats
// @access  Private/Admin
const getPlatformStats = asyncHandler(async (req, res) => {
  const [
    totalUsers, totalLost, totalFound, totalMatches,
    verifiedMatches, returnedMatches, highMatches, pendingMatches, totalClaims, pendingClaims, aiMatches,
  ] = await Promise.all([
    User.countDocuments(),
    LostItem.countDocuments(),
    FoundItem.countDocuments(),
    Match.countDocuments(),
    Match.countDocuments({ status: 'Verified' }),
    Match.countDocuments({ status: 'Returned' }),
    Match.countDocuments({ matchLevel: 'High Match' }),
    Match.countDocuments({ status: 'Pending' }),
    Claim.countDocuments(),
    Claim.countDocuments({ status: 'pending' }),
    Match.countDocuments({ $or: [{ isAiMatch: true }, { imageSimilarityScore: { $gte: 80 } }] }),
  ]);

  sendSuccess(res, 200, 'Platform statistics fetched successfully', {
    totalUsers,
    totalLost,
    totalFound,
    totalMatches,
    verifiedMatches,
    returnedMatches,
    highMatches,
    pendingMatches,
    totalClaims,
    pendingClaims,
    aiMatches,
  });
});

module.exports = {
  getAllUsers,
  getAllLostItemsAdmin,
  getAllFoundItemsAdmin,
  getAllMatchesAdmin,
  getMatchByIdAdmin,
  verifyMatch,
  rejectMatch,
  markMatchReturned,
  deleteLostItemAdmin,
  deleteFoundItemAdmin,
  getPlatformStats,
  getAllClaimsAdmin,
  updateClaimStatus,
  markClaimReturned,
};
