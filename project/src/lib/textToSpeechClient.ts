// Use browser-native APIs instead of Node.js Buffer
const encoder = new TextEncoder();

// Token cache to avoid unnecessary token generation
let cachedToken: { token: string; expiry: number } | null = null;

// Define supported voices with their genders
const SUPPORTED_VOICES = {
  'en-US-Wavenet-D': 'MALE',
  'en-US-Wavenet-F': 'FEMALE',
  'en-US-Wavenet-A': 'FEMALE',
  'en-US-Wavenet-B': 'MALE',
  'en-US-Wavenet-C': 'FEMALE',
  'en-US-Wavenet-E': 'FEMALE',
} as const;

// Default voice configuration
const DEFAULT_VOICE = {
  name: 'en-US-Wavenet-D',
  gender: 'MALE' as const,
};

async function makeRequest(text: string, config: SynthesisConfig = {}) {
  try {
    const credentials = {
      client_email: import.meta.env.VITE_GOOGLE_CLOUD_CLIENT_EMAIL,
      private_key: import.meta.env.VITE_GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    };

    if (!credentials.client_email || !credentials.private_key) {
      throw new Error('Missing Google Cloud credentials. Please check your environment variables.');
    }

    // Validate text input
    if (!text || typeof text !== 'string') {
      throw new Error('Invalid text input: Text must be a non-empty string');
    }

    // Limit text length to prevent API errors
    const MAX_TEXT_LENGTH = 5000;
    if (text.length > MAX_TEXT_LENGTH) {
      console.warn(`Text length exceeds ${MAX_TEXT_LENGTH} characters. Truncating...`);
      text = text.substring(0, MAX_TEXT_LENGTH);
    }

    // Validate and normalize voice configuration
    const voiceName = config.name || DEFAULT_VOICE.name;
    const voiceGender = SUPPORTED_VOICES[voiceName as keyof typeof SUPPORTED_VOICES] || DEFAULT_VOICE.gender;

    const url = 'https://texttospeech.googleapis.com/v1/text:synthesize';
    const request = {
      input: { text },
      voice: {
        languageCode: config.languageCode || 'en-US',
        name: voiceName,
        ssmlGender: voiceGender,
      },
      audioConfig: {
        audioEncoding: 'MP3',
        pitch: config.pitch || 0,
        speakingRate: config.speakingRate || 1.0,
        volumeGainDb: 0.0,
        effectsProfileId: ['small-bluetooth-speaker-class-device'],
      },
    };

    // Get token with retry logic
    let token: string;
    try {
      token = await getAccessToken(credentials);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown token error';
      console.error('Token generation failed, retrying...', errorMessage);
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1s before retry
      cachedToken = null;
      token = await getAccessToken(credentials);
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'X-Goog-User-Project': 'xortal-v1',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      let errorMessage = `Text-to-Speech API error (${response.status}): ${response.statusText}`;
      try {
        const errorData = await response.json();
        if (errorData?.error?.message) {
          errorMessage += `\nDetails: ${errorData.error.message}`;
        }
        if (errorData?.error?.details) {
          errorMessage += `\nAdditional Info: ${JSON.stringify(errorData.error.details)}`;
        }
      } catch (parseError) {
        errorMessage += '\nFailed to parse error response';
      }
      throw new Error(errorMessage);
    }

    const data = await response.json();
    if (!data?.audioContent) {
      throw new Error('No audio content in response. The API returned an empty result.');
    }

    return data.audioContent;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Text-to-Speech request failed:', {
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined
    });
    throw error;
  }
}

async function getAccessToken(credentials: any): Promise<string> {
  try {
    // Validate credentials
    if (!credentials?.client_email || !credentials?.private_key) {
      throw new Error('Invalid credentials: Missing client_email or private_key');
    }

    // Check cache first
    const now = Math.floor(Date.now() / 1000);
    if (cachedToken?.token && cachedToken.expiry > now + 300) { // 5 min buffer
      return cachedToken.token;
    }

    const expiry = now + 3600; // Token valid for 1 hour

    const header = {
      alg: 'RS256',
      typ: 'JWT',
    };

    const claim = {
      iss: credentials.client_email,
      scope: 'https://www.googleapis.com/auth/cloud-platform',
      aud: 'https://oauth2.googleapis.com/token',
      exp: expiry,
      iat: now,
    };

    const headerBase64 = btoa(JSON.stringify(header))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    
    const claimBase64 = btoa(JSON.stringify(claim))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    const signatureInput = `${headerBase64}.${claimBase64}`;

    // Import key with validation and retry
    let key: CryptoKey;
    try {
      key = await importPrivateKey(credentials.private_key);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown key import error';
      console.error('Key import failed, retrying...', errorMessage);
      await new Promise(resolve => setTimeout(resolve, 1000));
      key = await importPrivateKey(credentials.private_key);
    }

    const signature = await sign(signatureInput, key);
    const jwt = `${signatureInput}.${signature}`;

    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: jwt,
      }),
    });

    if (!tokenResponse.ok) {
      let errorMessage = `Failed to get access token (${tokenResponse.status})`;
      try {
        const errorData = await tokenResponse.json();
        if (errorData?.error_description) {
          errorMessage += `: ${errorData.error_description}`;
        }
        if (errorData?.error) {
          errorMessage += `\nError: ${errorData.error}`;
        }
      } catch {
        errorMessage += `: ${tokenResponse.statusText}`;
      }
      throw new Error(errorMessage);
    }

    const tokenData = await tokenResponse.json();
    if (!tokenData?.access_token) {
      throw new Error('No access token in response. Invalid token data received.');
    }

    // Cache the token
    cachedToken = {
      token: tokenData.access_token,
      expiry: now + (tokenData.expires_in || 3600),
    };

    return tokenData.access_token;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown token error';
    console.error('Failed to get access token:', {
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined
    });
    throw error;
  }
}

async function importPrivateKey(pemKey: string): Promise<CryptoKey> {
  try {
    if (!pemKey) {
      throw new Error('Private key is missing');
    }

    // Validate PEM format
    if (!pemKey.includes('-----BEGIN PRIVATE KEY-----') || 
        !pemKey.includes('-----END PRIVATE KEY-----')) {
      throw new Error('Invalid PEM format: Missing header or footer');
    }

    // Convert PEM to binary
    const pemHeader = '-----BEGIN PRIVATE KEY-----';
    const pemFooter = '-----END PRIVATE KEY-----';
    const pemContents = pemKey
      .replace(pemHeader, '')
      .replace(pemFooter, '')
      .replace(/\s/g, '');
    
    if (!pemContents) {
      throw new Error('Empty key contents: No key data found between header and footer');
    }

    let binaryKey: Uint8Array;
    try {
      binaryKey = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));
    } catch (error) {
      throw new Error(`Invalid base64 encoding: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    const key = await crypto.subtle.importKey(
      'pkcs8',
      binaryKey,
      {
        name: 'RSASSA-PKCS1-v1_5',
        hash: 'SHA-256',
      },
      false,
      ['sign']
    );

    if (!key) {
      throw new Error('Failed to import key: crypto.subtle.importKey returned null');
    }

    return key;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown key import error';
    console.error('Failed to import private key:', {
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined
    });
    throw new Error(`Invalid private key format: ${errorMessage}`);
  }
}

async function sign(input: string, key: CryptoKey): Promise<string> {
  try {
    if (!input) {
      throw new Error('Empty input: Nothing to sign');
    }

    const encoded = encoder.encode(input);
    const signature = await crypto.subtle.sign(
      'RSASSA-PKCS1-v1_5',
      key,
      encoded
    );
    
    if (!signature) {
      throw new Error('Failed to generate signature: crypto.subtle.sign returned null');
    }

    return btoa(String.fromCharCode(...new Uint8Array(signature)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown signing error';
    console.error('Failed to sign JWT:', {
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined
    });
    throw new Error(`Failed to generate signature: ${errorMessage}`);
  }
}

export interface SynthesisConfig {
  languageCode?: string;
  name?: string;
  ssmlGender?: 'MALE' | 'FEMALE';
  pitch?: number;
  speakingRate?: number;
}

// Add a utility function to get available voices
export function getAvailableVoices(): Array<{ name: string; gender: 'MALE' | 'FEMALE' }> {
  return Object.entries(SUPPORTED_VOICES).map(([name, gender]) => ({
    name,
    gender: gender as 'MALE' | 'FEMALE',
  }));
}

export async function synthesizeSpeech(
  text: string,
  config: SynthesisConfig = {}
): Promise<ArrayBuffer> {
  try {
    if (!text?.trim()) {
      throw new Error('Empty text provided: Text must be non-empty');
    }

    const base64Audio = await makeRequest(text, config);
    
    let binaryString: string;
    try {
      binaryString = atob(base64Audio);
    } catch (error) {
      throw new Error(`Invalid audio data format: ${error instanceof Error ? error.message : 'Failed to decode base64'}`);
    }

    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Validate audio data
    if (bytes.length === 0) {
      throw new Error('Empty audio data received: Generated audio has zero length');
    }

    // Validate audio format (check for MP3 header magic number)
    if (bytes[0] !== 0xFF || (bytes[1] & 0xE0) !== 0xE0) {
      throw new Error('Invalid audio format: Not a valid MP3 file');
    }

    return bytes.buffer;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown synthesis error';
    console.error('Text-to-Speech error:', {
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined
    });
    throw error;
  }
}

// Cache for storing synthesized audio
const audioCache = new Map<string, ArrayBuffer>();
const MAX_CACHE_SIZE = 50; // Maximum number of cached items
const MAX_TEXT_LENGTH = 5000; // Maximum text length to cache

export async function getCachedSpeech(
  text: string,
  config: SynthesisConfig = {}
): Promise<ArrayBuffer> {
  try {
    if (!text?.trim()) {
      throw new Error('Empty text provided: Text must be non-empty');
    }

    // Only cache if text is not too long
    const shouldCache = text.length <= MAX_TEXT_LENGTH;
    if (shouldCache) {
      const cacheKey = JSON.stringify({ text, config });
      
      const cachedAudio = audioCache.get(cacheKey);
      if (cachedAudio) {
        // Validate cached audio
        if (cachedAudio.byteLength > 0) {
          // Verify MP3 format
          const bytes = new Uint8Array(cachedAudio);
          if (bytes[0] === 0xFF && (bytes[1] & 0xE0) === 0xE0) {
            return cachedAudio.slice(0); // Return a copy to prevent mutations
          }
        }
        console.warn('Invalid cached audio detected, removing from cache');
        audioCache.delete(cacheKey);
      }

      const audio = await synthesizeSpeech(text, config);
      
      // Validate audio before caching
      if (audio.byteLength === 0) {
        throw new Error('Generated audio is empty: Zero bytes received');
      }
      
      // Add to cache
      audioCache.set(cacheKey, audio.slice(0)); // Store a copy
      
      // Limit cache size
      if (audioCache.size > MAX_CACHE_SIZE) {
        const firstKey = audioCache.keys().next().value;
        audioCache.delete(firstKey);
      }

      return audio;
    }

    // For long text, just synthesize without caching
    return await synthesizeSpeech(text, config);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown cache error';
    console.error('Failed to get speech:', {
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
      text: text.length > 100 ? `${text.substring(0, 100)}...` : text
    });
    throw error;
  }
}