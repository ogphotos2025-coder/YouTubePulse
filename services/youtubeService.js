const axios = require('axios');
const { YoutubeTranscript } = require('youtube-transcript');

class YouTubeService {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseURL = 'https://www.googleapis.com/youtube/v3';
  }

  async getChannelId(channelHandle) {
    try {
      const handle = channelHandle.replace('@', '');
      
      const response = await axios.get(`${this.baseURL}/search`, {
        params: {
          part: 'snippet',
          q: handle,
          type: 'channel',
          maxResults: 1,
          key: this.apiKey
        }
      });

      if (response.data.items.length === 0) {
        throw new Error('Channel not found');
      }

      return response.data.items[0].snippet.channelId;
    } catch (error) {
      throw new Error(`Error finding channel: ${error.message}`);
    }
  }

  async getLatestVideos(channelId) {
    try {
      const response = await axios.get(`${this.baseURL}/search`, {
        params: {
          part: 'snippet',
          channelId: channelId,
          order: 'date',
          type: 'video',
          maxResults: 10,
          key: this.apiKey
        }
      });

      return response.data.items.map(item => ({
        videoId: item.id.videoId,
        title: item.snippet.title,
        description: item.snippet.description,
        publishedAt: item.snippet.publishedAt,
        thumbnails: item.snippet.thumbnails
      }));
    } catch (error) {
      throw new Error(`Error fetching videos: ${error.message}`);
    }
  }

  async getTranscript(videoId) {
    try {
      const transcript = await YoutubeTranscript.fetchTranscript(videoId);
      const fullTranscript = transcript.map(item => item.text).join(' ');
      return fullTranscript;
    } catch (error) {
      console.log(`No transcript available for video ${videoId}`);
      return null;
    }
  }

  async getTopComments(videoId, maxResults = 50) {
    try {
      const response = await axios.get(`${this.baseURL}/commentThreads`, {
        params: {
          part: 'snippet',
          videoId: videoId,
          order: 'relevance',
          maxResults: maxResults,
          key: this.apiKey
        }
      });

      return response.data.items.map(item => ({
        text: item.snippet.topLevelComment.snippet.textDisplay,
        likeCount: item.snippet.topLevelComment.snippet.likeCount,
        author: item.snippet.topLevelComment.snippet.authorDisplayName,
        publishedAt: item.snippet.topLevelComment.snippet.publishedAt
      }));
    } catch (error) {
      console.log(`Error fetching comments for video ${videoId}`);
      return [];
    }
  }

  async getVideoStats(videoId) {
    try {
      const response = await axios.get(`${this.baseURL}/videos`, {
        params: {
          part: 'statistics,contentDetails',
          id: videoId,
          key: this.apiKey
        }
      });

      const video = response.data.items[0];
      return {
        viewCount: video.statistics.viewCount,
        likeCount: video.statistics.likeCount,
        commentCount: video.statistics.commentCount,
        duration: video.contentDetails.duration
      };
    } catch (error) {
      throw new Error(`Error fetching video stats: ${error.message}`);
    }
  }

  async getChannelStats(channelId) {
    try {
      const response = await axios.get(`${this.baseURL}/channels`, {
        params: {
          part: 'statistics,snippet',
          id: channelId,
          key: this.apiKey
        }
      });

      const channel = response.data.items[0];
      return {
        subscriberCount: channel.statistics.subscriberCount,
        totalViews: channel.statistics.viewCount,
        totalVideos: channel.statistics.videoCount,
        channelName: channel.snippet.title,
        channelDescription: channel.snippet.description,
        publishedAt: channel.snippet.publishedAt
      };
    } catch (error) {
      throw new Error(`Error fetching channel stats: ${error.message}`);
    }
  }

  async gatherChannelIntelligence(channelHandle) {
    try {
      const channelId = await this.getChannelId(channelHandle);
      const channelStats = await this.getChannelStats(channelId);
      const videos = await this.getLatestVideos(channelId);
      
      const videoData = await Promise.all(
        videos.map(async (video) => {
          const [transcript, comments, stats] = await Promise.all([
            this.getTranscript(video.videoId),
            this.getTopComments(video.videoId, 50),
            this.getVideoStats(video.videoId)
          ]);

          return {
            ...video,
            transcript,
            comments,
            stats
          };
        })
      );

      return {
        channelId,
        channelHandle,
        channelStats,
        videos: videoData,
        totalVideosAnalyzed: videoData.length,
        totalComments: videoData.reduce((sum, v) => sum + v.comments.length, 0)
      };
    } catch (error) {
      throw new Error(`Intelligence gathering failed: ${error.message}`);
    }
  }
}

module.exports = YouTubeService;
