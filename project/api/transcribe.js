const { SpeechClient } = require('@google-cloud/speech');

// Initialize the client with credentials from environment variables
const speechClient = new SpeechClient({
  credentials: {
    client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  },
  projectId: 'xortal-v1',
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { audio, config } = req.body;

    const request = {
      audio: { content: audio },
      config,
    };

    const [response] = await speechClient.recognize(request);
    const result = response.results?.[0];

    if (!result) {
      return res.status(400).json({ error: 'No transcription results' });
    }

    const alternative = result.alternatives?.[0];
    
    return res.status(200).json({
      text: alternative?.transcript || '',
      confidence: alternative?.confidence || 0,
      words: alternative?.words?.map(word => ({
        word: word.word || '',
        startTime: word.startTime?.seconds || 0,
        endTime: word.endTime?.seconds || 0,
        confidence: word.confidence || 0,
      })) || [],
    });
  } catch (error) {
    console.error('Transcription error:', error);
    return res.status(500).json({ error: 'Transcription failed' });
  }
}