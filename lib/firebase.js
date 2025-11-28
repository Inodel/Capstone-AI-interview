import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, collection, doc, getDocs, getDoc, addDoc, updateDoc, deleteDoc, query, where, orderBy, limit, setDoc } from 'firebase/firestore';
import { getAnalytics } from 'firebase/analytics';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
};

console.log('Firebase Config:', firebaseConfig);

let app;
try {
  app = initializeApp(firebaseConfig);
  console.log('Firebase app initialized successfully');
} catch (error) {
  console.error('Firebase initialization error:', error);
  throw error;
}

export const auth = getAuth(app);
export const db = getFirestore(app);

console.log('Firebase Auth:', auth);
console.log('Firebase DB:', db);


let analytics;
if (typeof window !== 'undefined') {
  analytics = getAnalytics(app);
}
export { analytics };


export const getUserByEmail = async (email) => {
  const q = query(collection(db, 'users'), where('email', '==', email), limit(1));
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;
  const doc = snapshot.docs[0];
  return { id: doc.id, ...doc.data() };
};

export const createUser = async (userData) => {
  const docRef = await addDoc(collection(db, 'users'), {
    ...userData,
    created_at: new Date(),
    updated_at: new Date()
  });
  return { id: docRef.id, ...userData };
};

export const updateUser = async (userId, userData) => {
  const userRef = doc(db, 'users', userId);
  await updateDoc(userRef, {
    ...userData,
    updated_at: new Date()
  });
};

export const getAllUsers = async () => {
  const snapshot = await getDocs(collection(db, 'users'));
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

export const createPasswordResetToken = async (tokenData) => {
  const docRef = await addDoc(collection(db, 'password_reset_tokens'), {
    ...tokenData,
    created_at: new Date()
  });
  return { id: docRef.id, ...tokenData };
};

export const getPasswordResetToken = async (token) => {
  const q = query(
    collection(db, 'password_reset_tokens'), 
    where('token', '==', token),
    where('is_used', '==', false),
    limit(1)
  );
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;
  const doc = snapshot.docs[0];
  const data = doc.data();
  
  if (data.expires_at.toDate() < new Date()) return null;
  
  return { id: doc.id, ...data };
};

export const markTokenAsUsed = async (tokenId) => {
  const tokenRef = doc(db, 'password_reset_tokens', tokenId);
  await updateDoc(tokenRef, { is_used: true });
};

export const updateUserPassword = async (userId, newPassword) => {
  const userRef = doc(db, 'users', userId);
  await updateDoc(userRef, {
    password: newPassword,
    updated_at: new Date()
  });
};

export const getInterviewSessions = async (userId) => {
  console.log('getInterviewSessions called with userId:', userId);
  
  try {
    const q = query(
      collection(db, 'interviews'),
      where('userId', '==', userId)
    );
    const snapshot = await getDocs(q);
    console.log('Query with userId snapshot size:', snapshot.size);
    
    const sessions = snapshot.docs.map(doc => {
      const data = doc.data();
      console.log('Interview data:', data);
      
      // Use overall_score directly as the main score
      // This ensures the dashboard shows the same score as the interview results
      const overallScore = data.overall_score || data.analysis?.overallScore || 0;
      
      return {
        id: doc.id,
        ...data,
        percentage_scored: Math.round(overallScore), // Use overall score directly
        created_at: data.timestamp || data.created_at || new Date(),
        session_name: data.topic || data.interviewType || 'Interview Session',
        interview_type: data.interviewType || 'General',
        topic: data.topic || 'General'
      };
    });
    
    const sortedSessions = sessions.sort((a, b) => {
      const dateA = a.created_at?.toDate ? a.created_at.toDate() : new Date(a.created_at);
      const dateB = b.created_at?.toDate ? b.created_at.toDate() : new Date(b.created_at);
      return dateB - dateA;
    });
    
    console.log('Processed sessions:', sortedSessions);
    return sortedSessions;
  } catch (error) {
    console.error('Error in getInterviewSessions:', error);
    return [];
  }
};

export const createInterviewSession = async (sessionData) => {
  const docRef = await addDoc(collection(db, 'interview_sessions'), {
    ...sessionData,
    created_at: new Date()
  });
  return { id: docRef.id, ...sessionData };
};

export const getQuestionCategories = async () => {
  const q = query(
    collection(db, 'question_categories'),
    where('is_active', '==', true),
    orderBy('sort_order')
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

export const createInterview = async (interviewData) => {
  const docRef = await addDoc(collection(db, 'interviews'), {
    ...interviewData,
    created_at: interviewData.timestamp || new Date()
  });
  console.log('Created interview document with ID:', docRef.id);
  return { id: docRef.id, ...interviewData };
};

export const getUserSubscription = async (userId) => {
  const docRef = doc(db, 'subscriptions', userId);
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    return docSnap.data();
  }
  return { plan: 'free', status: 'active' };
};

export const updateUserSubscription = async (userId, subscriptionData) => {
  const docRef = doc(db, 'subscriptions', userId);
  await setDoc(docRef, {
    userId,
    ...subscriptionData,
    updated_at: new Date()
  }, { merge: true });
};

export const createUserSubscription = async (userId, subscriptionData) => {
  const docRef = doc(db, 'subscriptions', userId);
  await setDoc(docRef, {
    userId,
    ...subscriptionData,
    created_at: new Date(),
    updated_at: new Date()
  });
};

