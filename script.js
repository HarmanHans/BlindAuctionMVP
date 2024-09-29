document.addEventListener("DOMContentLoaded", () => {
    fetch('sample.json')
        .then(response => response.json())
        .then(players => {
            const playerCardsContainer = document.getElementById('player-cards');
            players.forEach(player => {
                const card = document.createElement('div');
                card.className = 'card';
                card.innerHTML = `
                    <h2>${player.player}</h2>
                    <p>PPG: ${player.ppg}</p>
                    <p>APG: ${player.apg}</p>
                    <p>RPG: ${player.rpg}</p>
                    <p>Team: ${player.team}</p>
                    <input type="number" placeholder="Your Bid" />
                    <button>Bid</button>
                `;
                playerCardsContainer.appendChild(card);
            });
        })
        .catch(error => console.error('Error fetching player data:', error));
});