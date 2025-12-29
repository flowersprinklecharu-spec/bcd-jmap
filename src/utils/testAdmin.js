// Test file to check if admin state persists
// This will be imported in App.js to test storage persistence

let hasChecked = false;

export const testAdminPersistence = () => {
  if (hasChecked) return;
  hasChecked = true;
  
  console.log('🧪 Testing admin persistence...');
  
  // Check what's in storage right now
  const local = localStorage.getItem('isAdmin');
  const session = sessionStorage.getItem('isAdmin');
  
  console.log('🧪 Current storage:', { local, session });
  
  // If nothing is set, set a test value
  if (local !== 'true' && session !== 'true') {
    localStorage.setItem('isAdmin', 'true');
    console.log('🧪 Set test admin flag');
  }
  
  // Check again after a delay
  setTimeout(() => {
    const localAfter = localStorage.getItem('isAdmin');
    const sessionAfter = sessionStorage.getItem('isAdmin');
    console.log('🧪 Storage after 1 second:', { localAfter, sessionAfter });
    
    if (localAfter !== 'true') {
      console.log('🚨 localStorage was cleared! Something is removing admin flag');
    } else {
      console.log('✅ localStorage persisted');
    }
  }, 1000);
};