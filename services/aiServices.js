const axios = require('axios');

class AIService {
  constructor() {
    this.ollamaURL = 'http://localhost:11434/api/generate';
    this.model = 'llama3.2';
  }

  async callOllama(prompt) {
    try {
      const response = await axios.post(this.ollamaURL, {
        model: this.model,
        prompt: prompt,
        stream: false
      });
      return response.data.response;
    } catch (error) {
      throw new Error(`Ollama error: ${error.message}`);
    }
  }

  // Prompt 1: Feature Audit
  async analyzeFeatures(transcripts) {
    const combinedTranscripts = transcripts
      .filter(t => t !== null && t !== '')
      .join('\n\n---\n\n');

    if (!combinedTranscripts) {
      console.log('No transcripts available for feature analysis');
      return [];
    }

    const prompt = `You are a product analyst. Analyze these video transcripts and identify product features.

Categorize each as "New", "Updated", or "Legacy".

Transcripts:
${combinedTranscripts.substring(0, 3000)}

Return ONLY valid JSON array:
[{"feature": "name", "category": "New", "confidence": "high"}]`;

    try {
      const response = await this.callOllama(prompt);
      // Extract JSON from response
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      return [];
    } catch (error) {
      console.error('Feature analysis error:', error.message);
      return [];
    }
  }

  // Prompt 2: Sentiment Gap Analysis
  async analyzeSentiment(comments) {
    if (!comments || comments.length === 0) {
      return {
        complaints: [
          { text: "No comments available", frequency: "N/A" }
        ],
        mostRequestedFeature: "Unable to determine"
      };
    }

    const commentTexts = comments.map(c => c.text).join('\n');

    const prompt = `Analyze these YouTube comments. Find top 3 complaints and most requested feature.

Comments:
${commentTexts}

Return ONLY valid JSON:
{"complaints": [{"text": "...", "frequency": "high"}], "mostRequestedFeature": "..."}`;

    try {
      const response = await this.callOllama(prompt);
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      return {
        complaints: [{ text: "Unable to parse", frequency: "N/A" }],
        mostRequestedFeature: "Unable to determine"
      };
    } catch (error) {
      console.error('Sentiment analysis error:', error.message);
      return {
        complaints: [{ text: "Error analyzing", frequency: "N/A" }],
        mostRequestedFeature: "Unable to determine"
      };
    }
  }

  // Prompt 3: Hook Analysis
  async analyzeHooks(videoData) {
    const videoSummaries = videoData
      .map(v => `Title: ${v.title}\nDescription: ${v.description}`)
      .join('\n\n---\n\n');

    const prompt = `Analyze these video titles/descriptions. Identify the main emotional hook (FOMO, efficiency, revenue, etc).

Videos:
${videoSummaries}

Return ONLY valid JSON:
{"primaryHook": "...", "secondaryHooks": ["..."], "strategy": "..."}`;

    try {
      const response = await this.callOllama(prompt);
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      return {
        primaryHook: "Unable to determine",
        secondaryHooks: [],
        strategy: "Unable to determine"
      };
    } catch (error) {
      console.error('Hook analysis error:', error.message);
      return {
        primaryHook: "Unable to determine",
        secondaryHooks: [],
        strategy: "Unable to determine"
      };
    }
  }

  // Keyword extraction
  async extractKeywords(transcripts, videoData) {
    const transcriptText = transcripts.filter(t => t !== null && t !== '').join(' ');
    const titleDescText = videoData.map(v => `${v.title} ${v.description}`).join(' ');
    const combinedText = transcriptText || titleDescText;

    if (!combinedText) {
      console.log('No text available for keyword extraction');
      return [];
    }

    const prompt = `Extract 12 important keywords/buzzwords from this content.

Content:
${combinedText.substring(0, 3000)}

Return ONLY valid JSON array:
[{"keyword": "...", "importance": "high"}]`;

    try {
      const response = await this.callOllama(prompt);
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      return [];
    } catch (error) {
      console.error('Keyword extraction error:', error.message);
      return [];
    }
  }

  // Main intelligence analysis
  async generateIntelligence(youtubeData) {
    try {
      console.log('Starting AI intelligence generation with Ollama (local & free)...');
      
      const transcripts = youtubeData.videos.map(v => v.transcript);
      const allComments = youtubeData.videos.flatMap(v => v.comments);

      console.log(`Processing ${transcripts.length} transcripts and ${allComments.length} comments...`);

      // Run analyses sequentially (Ollama works better this way)
      const features = await this.analyzeFeatures(transcripts);
      const sentiment = await this.analyzeSentiment(allComments);
      const hooks = await this.analyzeHooks(youtubeData.videos);
      const keywords = await this.extractKeywords(transcripts, youtubeData.videos);

      console.log('AI analysis complete!');

      return {
        channelHandle: youtubeData.channelHandle,
        analyzedAt: new Date().toISOString(),
        features,
        sentiment,
        hooks,
        keywords,
        metadata: {
          videosAnalyzed: youtubeData.totalVideosAnalyzed,
          commentsAnalyzed: youtubeData.totalComments
        }
      };
    } catch (error) {
      throw new Error(`Intelligence generation failed: ${error.message}`);
    }
  }
}

module.exports = AIService;
