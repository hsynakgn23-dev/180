// Clear localStorage to force fresh daily selection fetch
console.log('Clearing DAILY_SELECTION_V14, DAILY_SELECTION_V15 and DAILY_SELECTION_V16 from localStorage...');
localStorage.removeItem('DAILY_SELECTION_V14');
localStorage.removeItem('DAILY_SELECTION_V15');
localStorage.removeItem('DAILY_SELECTION_V16');
console.log('Cleared! Refresh the page to fetch fresh movies from TMDB.');
