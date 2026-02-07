// Clear localStorage to force fresh daily selection fetch
console.log('Clearing DAILY_SELECTION_V14 and DAILY_SELECTION_V15 from localStorage...');
localStorage.removeItem('DAILY_SELECTION_V14');
localStorage.removeItem('DAILY_SELECTION_V15');
console.log('Cleared! Refresh the page to fetch fresh movies from TMDB.');
