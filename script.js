let dataset;

document.addEventListener("DOMContentLoaded", () => {
    fetch('sample.json')
        .then(response => response.json())
        .then(players => {
            dataset = players;
            const playerCardsContainer = document.getElementById('player-cards');
            players.forEach(player => {
                const card = document.createElement('div');
                card.className = 'card';
                card.innerHTML = `
                    <button class=nominate-button data-player-id="${player.id}">Nominate</button>
                    <h2>${player.player}</h2>
                    <p>PPG: ${player.ppg}</p>
                    <p>APG: ${player.apg}</p>
                    <p>RPG: ${player.rpg}</p>
                    <p>Team: ${player.team}</p>
                    <p>Pos: ${player.pos}</p>
                `;
                playerCardsContainer.appendChild(card);
            });
        })
        .catch(error => console.error('Error fetching player data:', error));

    const ROSTER_SIZE = 13;
    const NOMINATION_TIME = 20;
    const BIDDING_TIME = 20;
    const TOTAL_BUDGET = 200;
    const leagueSizeSelect = document.getElementById('league-size');
    const livePlayersSelect = document.getElementById('live-players');

    class Participant {
        constructor(name) {
            this.name = name;
            this.spent = 0;
            this.draftees = 0;
            this.budget = TOTAL_BUDGET;
            this.roster = [];
        }

        get playersLeft() {
            return ROSTER_SIZE - this.draftees;
        }

        get maxBid() {
            return this.budget - this.spent - this.playersLeft;
        }

        addPlayer() {
            draftees++;
        }

        adjustBudget() {
            return this.maxBid;
        }
    }

    leagueSizeSelect.addEventListener('change', function() {
        const selectedLeagueSize = parseInt(leagueSizeSelect.value);
        livePlayersSelect.innerHTML = '';

        if (selectedLeagueSize) {
            for (let i = 1; i <= selectedLeagueSize; i++) {
                const option = document.createElement('option');
                option.value = i;
                option.textContent = i;
                livePlayersSelect.appendChild(option);
            }
        }
    });

    document.getElementById('auction-settings').addEventListener('submit', function(event) {
        event.preventDefault();

        const leagueSize = parseInt(leagueSizeSelect.value);
        const livePlayers = parseInt(livePlayersSelect.value);
        const total = leagueSize * ROSTER_SIZE;

        document.getElementById('settings-form').classList.add('hidden');
        document.getElementById('auction-interface').classList.remove('hidden');
        
        console.log(`League Size: ${leagueSize}, Players in League: ${livePlayers}`);

        const participants = [];
        const orderingParticipants = Array.from({length: leagueSize}, (_, i) => `Participant ${i + 1}`);
        const randomizedOrder = randomizeArray(orderingParticipants);
        console.log("randomized order: ", randomizedOrder);
        for (let i = 0; i < randomizedOrder.length; i++) {
            participants.push(new Participant(randomizedOrder[i]));
        }

        startAuction(participants);
    });

    function randomizeArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    function startAuction(array) {
        const round = 1;
        enableNomination();
        for (let i = 0; i < ROSTER_SIZE; i++) {
            for (let j = 0; j < array.length; j++) {
                console.log((`It is ${array[j].name}'s turn to nominate.`));
                updateNominationText(array[j].name);
                
            }
        }
        
    }

    function updateNominationText(String) {
        const notif = document.getElementById('draft-notification');
        notif.innerText = `It is ${String}'s turn to nominate.`
    }

    function enableNomination() {
        const playerCardsContainer = document.getElementById('player-cards');
        playerCardsContainer.addEventListener('click', (event) => {
            if (event.target.matches('.nominate-button')) {
                const playerId = Number(event.target.getAttribute('data-player-id'));
                const nominatedPlayer = dataset.find(dataset => dataset.id === playerId);
                console.log('Nominated:', nominatedPlayer);
            }
        });
    }

});
