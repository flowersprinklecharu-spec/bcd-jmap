import { useState, useEffect } from 'react';

/**
 * Custom hook to handle the hidden keyboard shortcut (A-D-M-I-N) for admin access
 * Returns true when the sequence is detected
 */
export const useAdminKeyboardShortcut = () => {
  const [showAdminButton, setShowAdminButton] = useState(false);

  useEffect(() => {
    const keySequence = ['a', 'd', 'm', 'i', 'n'];
    let currentIndex = 0;
    let lastKeyTime = Date.now();
    const maxDelay = 3000; // 3 second window to complete sequence

    const handleKeyPress = (event) => {
      const currentTime = Date.now();
      
      // Reset if too much time has passed
      if (currentTime - lastKeyTime > maxDelay) {
        currentIndex = 0;
      }

      const key = event.key.toLowerCase();
      
      if (key === keySequence[currentIndex]) {
        currentIndex++;
        lastKeyTime = currentTime;

        // Complete sequence detected
        if (currentIndex === keySequence.length) {
          setShowAdminButton(true);
          currentIndex = 0;
          console.log('Admin button unlocked!');
        }
      } else {
        currentIndex = 0;
        // Restart if the current key matches the first key in sequence
        if (key === keySequence[0]) {
          currentIndex = 1;
          lastKeyTime = currentTime;
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);

  return showAdminButton;
};
