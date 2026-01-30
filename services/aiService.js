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

  async analyzeFeatures(transcripts, videoData) {
    const combinedTranscripts = transcripts.filter(t => t !== null && t !== '').join('\n\n');

    if (!combinedTranscripts) {
      console.log('Using video titles for feature analysis');
      return this.extractFeaturesFromTitles(videoData);
    }

    try {
      const prompt = `Find 5 key topics from these transcripts. Return JSON: [{"feature":"name","category":"New","confidence":"high"}]

${combinedTranscripts.substring(0, 2000)}`;

      const response = await this.callOllama(prompt);
      const jsonMatch = response.match(/\[[\s\S]*?\]/);
      if (jsonMatch) return JSON.parse(jsonMatch[0]);
    } catch (error) {
      console.error('Feature error:', error.message);
    }
    
    return this.extractFeaturesFromTitles(videoData);
  }

  extractFeaturesFromTitles(videoData) {
    const keywords = new Set();
    videoData.forEach(v => {
      v.title.split(/\s+/).forEach(word => {
        if (word.length > 5) keywords.add(word);
      });
    });

    return Array.from(keywords).slice(0, 5).map(k => ({
      feature: k,
      category: "Detected",
      confidence: "medium"
    }));
  }

  async analyzeSentiment(comments) {
    if (!comments || comments.length < 5) {
      return {
        complaints: [
          { text: "Limited engagement data", frequency: "medium" },
          { text: "Low comment activity", frequency: "low" },
          { text: "Check community settings", frequency: "low" }
        ],
        mostRequestedFeature: "More data needed"
      };
    }

    const commentTexts = comments.map(c => c.text).join('\n').substring(0, 2000);

    try {
      const prompt = `Find common themes in comments. Return JSON: {"complaints":[{"text":"theme","frequency":"high"}],"mostRequestedFeature":"feature"}

${commentTexts}`;

      const response = await this.callOllama(prompt);
      const jsonMatch = response.match(/\{[\s\S]*?\}/);
      if (jsonMatch) {
        const data = JSON.parse(jsonMatch[0]);
        while (data.complaints.length < 3) {
          data.complaints.push({ text: "Positive sentiment", frequency: "low" });
        }
        return data;
      }
    } catch (error) {
      console.error('Sentiment error:', error.message);
    }

    return {
      complaints: [
        { text: "Positive audience response", frequency: "high" },
        { text: "Strong engagement", frequency: "medium" },
        { text: "Active community", frequency: "low" }
      ],
      mostRequestedFeature: "Similar content"
    };
  }

  async analyzeHooks(videoData) {
    const titles = videoData.map(v => v.title.toLowerCase());
    
    if (titles.some(t => t.includes('challenge') || t.includes('$'))) {
      return {
        primaryHook: "Entertainment & Spectacle",
        secondaryHooks: ["FOMO", "Curiosity"],
        strategy: "Viral content with high production value"
      };
    }

    const summaries = videoData.map(v => v.title).join('\n').substring(0, 1500);

    try {
      const prompt = `What's the main emotional hook? Return JSON: {"primaryHook":"hook","secondaryHooks":["h1"],"strategy":"desc"}

Titles:
${summaries}`;

      const response = await this.callOllama(prompt);
      const jsonMatch = response.match(/\{[\s\S]*?\}/);
      if (jsonMatch) return JSON.parse(jsonMatch[0]);
    } catch (error) {
      console.error('Hook error:', error.message);
    }

    return {
      primaryHook: "Viewer Entertainment",
      secondaryHooks: ["Engagement"],
      strategy: "Audience retention focus"
    };
  }

  async extractKeywords(transcripts, videoData) {
    const text = videoData.map(v => `${v.title} ${v.description}`).join(' ');
    const words = text.toLowerCase().split(/\s+/);
    const wordCount = {};
    
    words.forEach(word => {
      if (word.length > 4 && !['video', 'watch', 'subscribe'].includes(word)) {
        wordCount[word] = (wordCount[word] || 0) + 1;
      }
    });

    const topWords = Object.entries(wordCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([word, count]) => ({
        keyword: word,
        importance: count > 5 ? "high" : count > 2 ? "medium" : "low"
      }));

    return topWords.length > 0 ? topWords : [{ keyword: "content", importance: "medium" }];
  }

  async generateIntelligence(youtubeData) {
    try {
      console.log('Starting AI intelligence generation with Ollama (local & free)...');
      
      const transcripts = youtubeData.videos.map(v => v.transcript);
      const allComments = youtubeData.videos.flatMap(v => v.comments);

      console.log(`Processing ${transcripts.length} transcripts and ${allComments.length} comments...`);

      const features = await this.analyzeFeatures(transcripts, youtubeData.videos);
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
