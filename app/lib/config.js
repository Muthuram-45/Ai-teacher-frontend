
 export const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://ai-teacher-backend-r9pc.onrender.com';
// export const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
export const PYTHON_BACKEND_URL = process.env.NEXT_PUBLIC_PYTHON_BACKEND_URL || 'http://localhost:5000';
export const ATTENTION_POPUP_INTERVAL = process.env.NEXT_PUBLIC_ATTENTION_POPUP_INTERVAL || '10';

export const INACTIVITY_THRESHOLD_MS = 2 * 60 * 1000; // 2 minutes
export const ACTIVITY_GRACE_PERIOD_MS = 10 * 1000; // 10 seconds
// export const INACTIVITY_THRESHOLD_MS = 10 * 1000; // 10 seconds (instead of 2 mins)
// export const ACTIVITY_GRACE_PERIOD_MS = 3 * 1000; // 3 seconds (instead of 10 secs)
