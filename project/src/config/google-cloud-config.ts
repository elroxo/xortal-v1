import { SpeechClient } from '@google-cloud/speech';

// Initialize the Speech client with credentials
const credentials = {
  type: 'service_account',
  project_id: 'xortal-v1',
  private_key_id: import.meta.env.GOOGLE_CLOUD_PRIVATE_KEY_ID,
  private_key: import.meta.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  client_email: import.meta.env.GOOGLE_CLOUD_CLIENT_EMAIL,
  client_id: import.meta.env.GOOGLE_CLOUD_CLIENT_ID,
  auth_uri: 'https://accounts.google.com/o/oauth2/auth',
  token_uri: 'https://oauth2.googleapis.com/token',
  auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
  client_x509_cert_url: import.meta.env.GOOGLE_CLOUD_CLIENT_CERT_URL,
  universe_domain: 'googleapis.com'
};

export const speechClient = new SpeechClient({ credentials });

export const validateCredentials = async (): Promise<boolean> => {
  try {
    // Test the credentials by making a simple API call
    await speechClient.initialize();
    return true;
  } catch (error) {
    console.error('Failed to initialize Google Cloud client:', error);
    return false;
  }
};