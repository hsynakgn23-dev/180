// Debug script - Paste this in browser console to check which images fail
const images = [
    "https://image.tmdb.org/t/p/w500/gEU2QniE6E77NI6lCUYWGxUXinoj.jpg", // Interstellar
    "https://image.tmdb.org/t/p/w500/qJ2tW6WMUDux911r6m7haRef0WH.jpg", // Dark Knight
    "https://image.tmdb.org/t/p/w500/39wmItIWsg5sZMyRUKGkh661Ykd.jpg", // Spirited Away
    "https://image.tmdb.org/t/p/w500/7IiTTgloJzvGCzqHWXpWHDrrPo.jpg", // Parasite
    "https://image.tmdb.org/t/p/w500/ow3wq89wM8qd5X7hWKxiRfsFf9C.jpg"  // 12 Angry Men
];

const titles = ["Interstellar", "Dark Knight", "Spirited Away", "Parasite", "12 Angry Men"];

images.forEach((url, i) => {
    fetch(url, { method: 'HEAD', referrerPolicy: 'no-referrer' })
        .then(res => {
            if (res.ok) {
                console.log(`✅ ${titles[i]}: OK`);
            } else {
                console.error(`❌ ${titles[i]}: ${res.status}`);
            }
        })
        .catch(err => console.error(`❌ ${titles[i]}: FAILED`, err));
});
