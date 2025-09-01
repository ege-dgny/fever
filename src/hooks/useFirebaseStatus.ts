import { useEffect, useState } from 'react';
import { auth, db } from '../config/firebase';

export const useFirebaseStatus = () => {
  const [status, setStatus] = useState<{
    auth: boolean;
    firestore: boolean;
    error?: string;
  }>({
    auth: false,
    firestore: false
  });

  useEffect(() => {
    // Simply check if Firebase is initialized, don't make any requests
    const checkStatus = () => {
      try {
        // Check if auth is initialized
        if (auth && auth.app) {
          setStatus(prev => ({ ...prev, auth: true }));
        }
        
        // Check if Firestore is initialized
        if (db) {
          setStatus(prev => ({ ...prev, firestore: true }));
        }
      } catch (error) {
        console.error('Firebase status check error:', error);
        setStatus(prev => ({ ...prev, error: 'Firebase initialization check failed' }));
      }
    };

    checkStatus();
  }, []);

  return status;
};
