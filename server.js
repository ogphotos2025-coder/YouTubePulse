require('dotenv').config();
const express = require('express');
const cors = require('cors');
const YouTubeService = require('./services/youtubeService');
const AIService = require('./services/aiService');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const youtubeService = new YouTubeService(process.env.YOUTUBE_API_KEY);
const aiService = new AIService();

app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'online', 
    timestamp: new Date().toISOString(),
    aiProvider: 'Ollama (Local & Free)'
  });
});

app.post('/api/analyze', async (req, res) => {
  try {
    const { channelHandle } = req.body;

    if (!channelHandle) {
      return res.status(400).json({ error: 'Channel handle is required' });
    }

    console.log(`\n🎯 Analyzing channel: ${channelHandle}`);
    console.log('📊 Step 1: Gathering YouTube data...');
    
    const youtubeData = await youtubeService.gatherChannelIntelligence(channelHandle);
    console.log(`✓ Found ${youtubeData.totalVideosAnalyzed} videos with ${youtubeData.totalComments} comments`);

    console.log('🤖 Step 2: Running AI analysis (this may take 30-60 seconds)...');
    const intelligence = await aiService.generateIntelligence(youtubeData);
    console.log('✓ AI analysis complete!');

    const metrics = calculateEnhancedMetrics(youtubeData);

    res.json({
      success: true,
      data: {
        ...intelligence,
        metrics,
        channelInfo: youtubeData.channelStats,
        videoBreakdown: getVideoBreakdown(youtubeData.videos)
      }
    });
  } catch (error) {
    console.error('❌ Analysis error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

function calculateEnhancedMetrics(youtubeData) {
  const videos = youtubeData.videos;
  
  const totalViews = videos.reduce((sum, v) => sum + parseInt(v.stats.viewCount || 0), 0);
  const totalLikes = videos.reduce((sum, v) => sum + parseInt(v.stats.likeCount || 0), 0);
  const totalComments = videos.reduce((sum, v) => sum + parseInt(v.stats.commentCount || 0), 0);
  
  const avgViews = Math.round(totalViews / videos.length);
  const avgLikes = Math.round(totalLikes / videos.length);
  const avgComments = Math.round(totalComments / videos.length);

  const engagementRate = totalViews > 0 ? ((totalLikes / totalViews) * 100).toFixed(2) : '0.00';
  const commentRate = totalViews > 0 ? ((totalComments / totalViews) * 100).toFixed(2) : '0.00';

  const bestVideo = videos.reduce((best, current) => {
    const currentViews = parseInt(current.stats.viewCount || 0);
    const bestViews = parseInt(best.stats.viewCount || 0);
    return currentViews > bestViews ? current : best;
  }, videos[0]);

  const dates = videos.map(v => new Date(v.publishedAt)).sort((a, b) => b - a);
  const daysBetweenFirstAndLast = (dates[0] - dates[dates.length - 1]) / (1000 * 60 * 60 * 24);
  const uploadFrequency = daysBetweenFirstAndLast > 0 ? ((videos.length / daysBetweenFirstAndLast) * 7).toFixed(1) : '0';

  const midpoint = Math.floor(videos.length / 2);
  const recentVideos = videos.slice(0, midpoint);
  const olderVideos = videos.slice(midpoint);
  
  const recentAvgViews = recentVideos.reduce((sum, v) => sum + parseInt(v.stats.viewCount || 0), 0) / recentVideos.length;
  const olderAvgViews = olderVideos.reduce((sum, v) => sum + parseInt(v.stats.viewCount || 0), 0) / olderVideos.length;
  
  const viewsTrend = olderAvgViews > 0 ? (((recentAvgViews - olderAvgViews) / olderAvgViews) * 100).toFixed(1) : '0';

  const videosWithTranscripts = videos.filter(v => v.transcript && v.transcript.length > 0).length;
  const transcriptAvailability = ((videosWithTranscripts / videos.length) * 100).toFixed(0);

  return {
    videosAnalyzed: videos.length,
    commentsProcessed: youtubeData.totalComments,
    totalViews,
    avgViews,
    viewsTrend: parseFloat(viewsTrend),
    totalLikes,
    avgLikes,
    engagementRate: parseFloat(engagementRate),
    totalComments,
    avgComments,
    commentRate: parseFloat(commentRate),
    bestPerformingVideo: {
      title: bestVideo.title,
      views: bestVideo.stats.viewCount,
      likes: bestVideo.stats.likeCount
    },
    uploadFrequency: parseFloat(uploadFrequency),
    transcriptAvailability: parseInt(transcriptAvailability),
    subscriberCount: youtubeData.channelStats.subscriberCount,
    totalChannelViews: youtubeData.channelStats.totalViews,
    totalChannelVideos: youtubeData.channelStats.totalVideos
  };
}

function getVideoBreakdown(videos) {
  return videos.map(v => ({
    title: v.title,
    publishedAt: v.publishedAt,
    views: parseInt(v.stats.viewCount || 0),
    likes: parseInt(v.stats.likeCount || 0),
    comments: parseInt(v.stats.commentCount || 0),
    engagementRate: parseInt(v.stats.viewCount) > 0 
      ? ((parseInt(v.stats.likeCount) / parseInt(v.stats.viewCount)) * 100).toFixed(2)
      : '0.00',
    hasTranscript: v.transcript && v.transcript.length > 0,
    commentCount: v.comments.length
  })).sort((a, b) => b.views - a.views);
}

app.listen(PORT, () => {
  console.log(`\n🚀 PulseInsight API Server Started!`);
  console.log(`📍 Running on: http://localhost:${PORT}`);
  console.log(`🤖 AI Provider: Ollama (Local & Free)`);
  console.log(`📊 Ready to analyze competitors!\n`);
});
