// Product image upload for the billing app.
//
// Images are uploaded to the SAME Firebase Storage bucket the Laxorashopping
// website uses, so a product's pictures are served from one place whether the
// listing is managed from billing or from the website admin.
//
// The Firebase project config is public by design (Firebase web config is not a
// secret; access is governed by Storage security rules). To point at a
// different project, set NEXT_PUBLIC_FIREBASE_* env vars.

import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyAoRjQqAP-3QO9rjoQK7SSZ788lyMmhXmU",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "eb-tracker-42881.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "eb-tracker-42881",
  storageBucket:
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "eb-tracker-42881.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_SENDER_ID || "922340749018",
  appId:
    process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:922340749018:web:68296d8775a79e71b2bfe3",
};

function app(): FirebaseApp {
  return getApps().length ? getApp() : initializeApp(firebaseConfig);
}

// Uploads one image file and returns its public download URL.
export async function uploadProductImage(file: File): Promise<string> {
  const storage = getStorage(app());
  const fileName = `${Date.now()}_${file.name.replace(/\s+/g, "-")}`;
  const storageRef = ref(storage, `product-images/${fileName}`);
  await uploadBytes(storageRef, file);
  return getDownloadURL(storageRef);
}
