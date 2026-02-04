// Clear localStorage to force fresh TMDB fetch
console.log('Clearing DAILY_SELECTION_V2 from localStorage...');
localStorage.removeItem('DAILY_SELECTION_V2');
console.log('Cleared! Refresh the page to fetch fresh movies from TMDB.');
