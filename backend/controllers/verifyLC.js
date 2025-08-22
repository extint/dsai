const { LeetCode } = require('leetcode-query');
const leetcodeClient = new LeetCode();
const redisClient = require('../redisClient');

// Helper to add delay
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Direct GraphQL user validation function
async function validateUserExists(username) {
  const query = `
    query userProfile($username: String!) {
      matchedUser(username: $username) {
        username
        profile {
          realName
          userAvatar
          reputation
          ranking
        }
      }
    }
  `;

  const response = await fetch('https://leetcode.com/graphql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Referer': 'https://leetcode.com',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    },
    body: JSON.stringify({
      query,
      variables: { username }
    })
  });

  if (!response.ok) {
    throw new Error(`User validation API returned ${response.status}`);
  }

  const data = await response.json();
  
  if (data.errors) {
    throw new Error(`GraphQL errors: ${JSON.stringify(data.errors)}`);
  }

  return data.data.matchedUser;
}

// Direct GraphQL recent submissions function
async function getRecentSubmissions(username) {
  const query = `
    query recentSubmissionList($username: String!) {
      recentSubmissionList(username: $username) {
        title
        titleSlug
        timestamp
        statusDisplay
        lang
        __typename
      }
    }
  `;

  const response = await fetch('https://leetcode.com/graphql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Referer': 'https://leetcode.com',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    },
    body: JSON.stringify({
      query,
      variables: { username }
    })
  });

  if (!response.ok) {
    throw new Error(`Submissions API returned ${response.status}`);
  }

  const data = await response.json();
  
  if (data.errors) {
    throw new Error(`GraphQL errors: ${JSON.stringify(data.errors)}`);
  }

  return data.data.recentSubmissionList || [];
}

// Retry function with exponential backoff
async function retryWithBackoff(fn, maxRetries = 3, baseDelay = 1000) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      console.error(`Attempt ${i + 1} failed:`, error.message);
      
      if (i === maxRetries - 1) {
        throw error; // Final attempt failed
      }
      
      const delayMs = baseDelay * Math.pow(2, i) + Math.random() * 1000;
      console.log(`Retrying in ${delayMs}ms...`);
      await delay(delayMs);
    }
  }
}

const USER_SUBMISSION_KEY = (roomId, username) => `room:${roomId}:user:${username}:submission`;

async function verifyLC(req, res) {
  try {
    const { roomId, username, lcHandle, targetSlug } = req.body;

    if (!roomId || !username || !lcHandle || !targetSlug) {
      return res.status(400).json({
        error: "Missing required fields: roomId, username, lcHandle, targetSlug"
      });
    }

    console.log(`Verifying submission for ${lcHandle} on problem ${targetSlug}`);

    // First, validate the user exists using direct GraphQL
    let userProfile;
    try {
      userProfile = await validateUserExists(lcHandle);
      if (!userProfile || !userProfile.username) {
        throw new Error(`User ${lcHandle} not found`);
      }
      console.log(`✅ User ${lcHandle} found - proceeding with submission check`);
    } catch (profileError) {
      console.error(`❌ User profile error for ${lcHandle}:`, profileError.message);
      return res.status(404).json({
        error: "LeetCode user not found",
        details: `The username "${lcHandle}" does not exist on LeetCode`,
        suggestion: "Please verify the LeetCode username is correct"
      });
    }

    // Query the recent submissions using direct GraphQL
    let submissions;
    try {
      submissions = await retryWithBackoff(async () => {
        console.log(`Fetching submissions for ${lcHandle}...`);
        
        const submissionList = await getRecentSubmissions(lcHandle);
        // console.log(submissionList);
        if (!Array.isArray(submissionList) || submissionList.length === 0) {
          throw new Error(`No recent submissions found for user ${lcHandle}. User may have no submissions or submissions are private.`);
        }
        
        console.log(`✅ Found ${submissionList.length} recent submissions for ${lcHandle}`);
        return submissionList;
      }, 3, 2000);

    } catch (err) {
      console.error("❌ LeetCode API error after retries:", err);
      return res.status(404).json({ 
        error: "No submissions found",
        details: err.message,
        suggestions: [
          "Verify the LeetCode username is spelled correctly",
          "Check if the user's submission history is set to public", 
          "Ensure the user has made recent submissions",
          "Try using a different LeetCode username that you know exists"
        ]
      });
    }

    // Find a submission matching the target problem slug
    console.log(`🔍 Searching for problem "${targetSlug}" in ${submissions.length} submissions...`);
    
    const lastSubmission = submissions[0];

    // Check if target slug is present anywhere within the last submission's titleSlug
    const match = lastSubmission && lastSubmission.titleSlug && 
      lastSubmission.title.toLowerCase().includes(targetSlug.toLowerCase());
    
    const success = match && (
      lastSubmission.statusDisplay === "Accepted" ||
      lastSubmission.status_display === "Accepted" ||
      lastSubmission.status === "Accepted"
    );

    if (match) {
      console.log(`✅ Found matching submission: ${match.title} - Status: ${match.statusDisplay}`);
    } else {
      console.log(`❌ No submission found for problem "${targetSlug}"`);
      console.log(`Available problems: ${submissions.map(s => s.titleSlug).slice(0, 5).join(', ')}...`);
    }

    // Store the verification result in Redis
    const submissionData = {
      username,
      lcHandle,
      targetSlug,
      status: success ? "success" : "failed",
      timestamp: Date.now(),
      matchedSubmission: match || null,
      totalSubmissionsChecked: submissions.length
    };

    await redisClient.set(
      USER_SUBMISSION_KEY(roomId, username),
      JSON.stringify(submissionData)
    );

    console.log(`🎯 Verification result for ${username}: ${success ? '✅ SUCCESS' : '❌ FAILED'}`);

    return res.json({
      success,
      status: submissionData.status,
      timestamp: submissionData.timestamp,
      message: success 
        ? `✅ LeetCode submission verified as Accepted for problem "${targetSlug}"` 
        : `❌ No accepted submission found for problem "${targetSlug}". Found ${submissions.length} recent submissions.`,
      submissionsChecked: submissions.length,
      userProfile: {
        username: userProfile.username,
        realName: userProfile.profile?.realName,
        ranking: userProfile.profile?.ranking
      }
    });

  } catch (err) {
    console.error("💥 Error in verifyLC:", err);
    return res.status(500).json({ 
      error: "Internal server error", 
      details: err.message 
    });
  }
}

module.exports = { verifyLC };
