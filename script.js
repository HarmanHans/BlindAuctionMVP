/**
 * @fileoverview This file contains the logic for the auction bidding process.
 * It handles, user and bot nominations, bidding, updates UI, and utilizes a
 * json file to insert player data.
 * 
 * Dependencies:
 * - playerData.json (contains stats of all NBA players)
 * @package
 */

let dataset;

document.addEventListener("DOMContentLoaded", () => {
    fetch('data.json')
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
    let leagueSize = 0;
    let currentSortOrder = new Array(11).fill(false);
    let timer;

    /**
     * Represents a participant in the auction, either a human or an AI.
     * 
     * This class manages the participant's bidding, budget, and roster,
     * along with their cumulative statistics. Participants can place bids,
     * winning bids adds players to their roster, and their performance is tracked 
     * during the auction.
     * 
     * @class
     */
    class Participant {
        /**
         * Creates an instance of Participant.
         * 
         * @param {string} name - The name of the participant.
         * @param {boolean} [isAi=false] - Indicates if the participant is an AI.
         */
        constructor(name, isAi = false) {
            this.name = name;
            this.spent = 0;
            this.draftees = 0;
            this.budget = TOTAL_BUDGET;
            this.roster = [];
            this.currentBid = 0;
            this.rank = 0;
            this.aggression = this.assignAggression();
            this.isAi = isAi;

            this.cumulativeStats = {
                fg_pct: 0.0,
                ft_pct: 0.0,
                ppg: 0,
                apg: 0,
                rpg: 0,
                three_p: 0,
                spg: 0,
                bpg: 0,
                tos: 0,
            };

            this.otherStats = {
                fga: 0,
                fgm: 0,
                fta: 0,
                ftm: 0,
            };
        }

        /**
         * Determines approximately the biggest amount a bot will bid on any player.
         * 
         * @returns {number} A randomly assigned maximum bid.
         */
        assignAggression() {
            const aggressionLevels = [43, 55, 65, 72];
            const rand = Math.floor(Math.random() * aggressionLevels.length);
            return aggressionLevels[rand];
        }

        get playersLeft() {
            return ROSTER_SIZE - this.draftees;
        }

        get maxBid() {
            return this.budget - this.spent - this.playersLeft;
        }


        addPlayer(id, bidAmount) {
            this.draftees++;
            const player = dataset.find(player => player.id === id);
            this.roster.push({player, bid: bidAmount});
            this.updateCumulativeStats(player);
        }


        updateCumulativeStats(player) {
            this.cumulativeStats.ppg += player.ppg || 0;
            this.cumulativeStats.apg += player.apg || 0;
            this.cumulativeStats.rpg += player.rpg || 0;
            this.cumulativeStats.three_p += player.three_p || 0;
            this.cumulativeStats.spg += player.spg || 0;
            this.cumulativeStats.bpg += player.bpg || 0;
            this.cumulativeStats.tos += player.tos || 0;
            this.otherStats.fga += player.fga || 0;
            this.otherStats.fta += player.fta || 0;


            this.calculateMakes(player.fga, player.fg_pct, 'fgm');
            this.calculateMakes(player.fta, player.ft_pct, 'ftm');
            this.cumulativeStats.fg_pct = this.calculatePct(this.otherStats.fgm, this.otherStats.fga);
            this.cumulativeStats.ft_pct = this.calculatePct(this.otherStats.ftm, this.otherStats.fta);
        }


        calculateMakes(attempts, pct, key) {
            if (pct != null) {
                this.otherStats[key] += pct * (attempts || 0) / 100;
            }
        }


        calculatePct(makes, attempts) {
            return attempts > 0 ? (makes / attempts) * 100 : 0;
        }


        adjustBudget() {
            return this.maxBid;
        }


        placeBid(amount) {
            if (amount <= this.maxBid) {
                this.currentBid = amount;
                return true;
            }
            return false;
        }


        resetBid() {
            this.currentBid = 0;
        }
    }

    /**
     * Toggles the visibility of the roster and stats containers based on the state of the toggle switch.
     * 
     * When the toggle switch is checked, the roster container is hidden, and the stats container is displayed.
     * When unchecked, the roster container is shown, and the stats container is hidden.
     * 
     * @event change
     * @param {Event} event - The change event triggered by the toggle switch.
     */
    document.getElementById('toggle-switch').addEventListener('change', function() {
        const rosterContainer = document.getElementById('roster-container');
        const statsContainer = document.getElementById('stats-container');


        if (this.checked) {
            rosterContainer.style.display = 'none';
            statsContainer.style.display = 'block';
        } else {
            rosterContainer.style.display = 'block';
            statsContainer.style.display = 'none';
        }
    });


    leagueSizeSelect.addEventListener('change', function() {
        const selectedLeagueSize = parseInt(leagueSizeSelect.value);
        livePlayersSelect.innerHTML = '';


        if (selectedLeagueSize) {
            for (let i = 0; i <= selectedLeagueSize; i++) {
                const option = document.createElement('option');
                option.value = i;
                option.textContent = i;
                livePlayersSelect.appendChild(option);
            }
        }
    });

    /**
     * Handles the submission of the auction settings form.
     * 
     * This function takes the league settings input by the user and initializes them. This includes the number 
     * of total participants, how many are bots vs. not, it generates the nomination order, and then starts the bidding process.
     * 
     * @param {Event} event - The submit event triggered by the form.
     */
    document.getElementById('auction-settings').addEventListener('submit', function(event) {
        event.preventDefault();


        leagueSize = parseInt(leagueSizeSelect.value);
        const realPlayersCount = parseInt(livePlayersSelect.value);
        const total = leagueSize * ROSTER_SIZE;


        document.getElementById('settings-form').classList.add('hidden');
        document.getElementById('auction-interface').classList.remove('hidden');


        const participants = [];
        const realParticipants = Array.from({ length: realPlayersCount }, (_, i) => (new Participant(`Player ${i + 1}`)));
        const botParticipants = Array.from({ length: (leagueSize - realPlayersCount) }, (_, i) =>
                                (new Participant(`Bot ${i + 1}`, true)));


        const orderingParticipants = [...realParticipants, ...botParticipants];
        const randomizedOrder = randomizeArray(orderingParticipants);
        for (let i = 0; i < randomizedOrder.length; i++) {
            participants.push(randomizedOrder[i]);
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

    /**
     * Starts the auction process for the given array of participants.
     * 
     * This asynchronous function initializes the draft and stats tables, then 
     * iterates through each round of nominations until each roster is full. 
     * It handles both human and AI participants, manages timers for nominations, 
     * and determines the highest bid for each nominated player.
     * 
     * @param {Array<Participant>} array - An array of Participant objects 
     *                                      representing the auction participants.
     * @returns {Promise<void>} A promise that resolves when the auction has 
     *                          completed.
     */
    async function startAuction(array) {
        let round = 1;
        initializeDraftTable(array);
        initializeStatsTable(array);


        for (let i = 0; i < ROSTER_SIZE; i++) {
            for (let j = 0; j < array.length; j++) {
                updateUpperText(array[j].name, "nominate");
                startTimer(NOMINATION_TIME);
                toggleBidInputVisibility(false);
                let id;
                if (array[j].isAi) {
                    id = await waitForNomination(array[j].isAi);
                } else {
                    id = await Promise.race([waitForNomination(array[j].isAi),
                    new Promise((resolve) => setTimeout(() => resolve(null), NOMINATION_TIME * 1000))]);
                }

                id = handleNomination(id);
                toggleBidInputVisibility(true);
                const nominator = array[j];
                const bidders = [...array.slice(j+1), ...array.slice(0,j)];

                await startBid(nominator, id, true);
                for (const bidder of bidders) {
                    await startBid(bidder, id, false);
                }

                selectHighestBid(array, id);
                updateDraftTable(array);
                array.forEach(participant => participant.resetBid());
            }
        }
    }


    function initializeDraftTable(array) {
        const [tableHeader, tableBody] = clearHTML('table-header', 'table-body');

        for (let i = 0; i < array.length; i++) {
            const th = document.createElement('th');
            th.innerText = `${array[i].name} $${TOTAL_BUDGET} ${ROSTER_SIZE - array[i].draftees}/${ROSTER_SIZE}`;
            tableHeader.appendChild(th);
        }

        for (let i = 0; i < ROSTER_SIZE; i++) {
            const tr = document.createElement('tr');
            for (let j = 1; j <= array.length; j++) {
                const td = document.createElement('td');
                tr.appendChild(td);
            }
            tableBody.appendChild(tr);
        }
    }


    function initializeStatsTable(array) {
        const [tableHeader, tableBody] = clearHTML('stats-table-header', 'stats-table-body');


        const headers = ['Team Name', 'Ranking', 'FG%', 'FT%', 'PPG', 'APG', 'RPG', '3P', 'SPG', 'BPG', 'TOS'];


        headers.forEach((header, index) => {
            const th = document.createElement('th');
            th.innerText = header;
            th.addEventListener('click', () => sortTable(array, index));
            tableHeader.appendChild(th);
        });


        array.forEach((participant) => {
            const row = document.createElement('tr');
            row.id = `participant-${participant.name.replace(/\s+/g, '-')}`;
            row.innerHTML = `
                <td id="participant-${participant.name.replace(/\s+/g, '-')}"
                    class="participant-name">${participant.name}</td>
                <td>${participant.rank}</td>
                <td>${participant.cumulativeStats.fg_pct.toFixed(2)}%</td>
                <td>${participant.cumulativeStats.ft_pct.toFixed(2)}%</td>
                <td>${participant.cumulativeStats.ppg.toFixed(2)}</td>
                <td>${participant.cumulativeStats.apg.toFixed(2)}</td>
                <td>${participant.cumulativeStats.rpg.toFixed(2)}</td>
                <td>${participant.cumulativeStats.three_p.toFixed(2)}</td>
                <td>${participant.cumulativeStats.spg.toFixed(2)}</td>
                <td>${participant.cumulativeStats.bpg.toFixed(2)}</td>
                <td>${participant.cumulativeStats.tos.toFixed(2)}</td>
            `;
            tableBody.appendChild(row);
            renderTableRows(array, tableBody);
        });
    }

    /**
     * Sorts the stats table in ascending or descending order based on which column the user selects.
     * By default, the stat table is sorted highest to lowest in team ranking.
     * 
     * @param {Array<Participant>} participants - The array of Participant objects to be sorted.
     * @param {number} columnIndex - The index of the column to sort by, corresponding 
     *                               to the keys in the sortingKeyMap. 
     */
    function sortTable(participants, columnIndex) {
        const sortingKeyMap = {
            0: 'name',
            1: 'rank',
            2: 'fg_pct',
            3: 'ft_pct',
            4: 'ppg',
            5: 'apg',
            6: 'rpg',
            7: 'three_p',
            8: 'spg',
            9: 'bpg',
            10: 'tos'
        };


        const sortedParticipants = [...participants];
        const sortingKey = sortingKeyMap[columnIndex];
        currentSortOrder[columnIndex] = !currentSortOrder[columnIndex];

        sortedParticipants.sort((a, b) => {
            if (sortingKey === 'name') {
                return a.name.localeCompare(b.name) * (currentSortOrder[columnIndex] ? 1 : -1);
            } else if (sortingKey === 'rank') {
                return (a.rank - b.rank) * (currentSortOrder[columnIndex] ? 1 : -1);
            } else {
                return (a.cumulativeStats[sortingKey] - b.cumulativeStats[sortingKey]) * (currentSortOrder[columnIndex] ? 1 : -1);
            }
        });

        const tableBody = document.getElementById('stats-table-body');
        renderTableRows(sortedParticipants, tableBody);
    }


    function updateStatsTable(participants) {
        const sortedParticipants = calculateHeadToHeadPoints(participants);
        renderTableRows(sortedParticipants, document.getElementById('stats-table-body'));
    }


    function renderTableRows(participants, tableBody) {
        tableBody.innerHTML = '';
        participants.forEach((participant, index) => {
            const row = document.createElement('tr');
            row.id = `participant-${participant.name.replace(/\s+/g, '-')}`;
            row.innerHTML = `
                <td class="participant-name">${participant.name}</td>
                <td>${participant.rank}</td>
                <td>${(participant.cumulativeStats.fg_pct * 100).toFixed(2)}%</td>
                <td>${(participant.cumulativeStats.ft_pct * 100).toFixed(2)}%</td>
                <td>${participant.cumulativeStats.ppg.toFixed(2)}</td>
                <td>${participant.cumulativeStats.apg.toFixed(2)}</td>
                <td>${participant.cumulativeStats.rpg.toFixed(2)}</td>
                <td>${participant.cumulativeStats.three_p.toFixed(2)}</td>
                <td>${participant.cumulativeStats.spg.toFixed(2)}</td>
                <td>${participant.cumulativeStats.bpg.toFixed(2)}</td>
                <td>${participant.cumulativeStats.tos.toFixed(2)}</td>
            `;
            tableBody.appendChild(row);
        });
    }

    /**
     * Compares the rosters of players head to head. The more teams a player's roster outranks others (based on
     * last year's stats), the higher the team will be ranked.
     * 
     * 
     * @param {Array<Participant>} participants - the array of Participant whose rosters will 
     *                                            be compared head to head. 
     * @returns {Array<Participant>} - the sorted array of Participants ranked by their strength in head to head.
     */
    function calculateHeadToHeadPoints(participants) {
        let sortedParticipants = [...participants];
        sortedParticipants.forEach(team => {
            team.h2hPoints = 0;


            sortedParticipants.forEach(opponent => {
                if (team !== opponent) {
                    let wins = 0;


                    const categories = ['fg_pct', 'ft_pct', 'ppg', 'apg', 'rpg', 'three_p', 'spg', 'bpg', 'tos'];
                    categories.forEach(category => {
                        if (team.cumulativeStats[category] > opponent.cumulativeStats[category]) {
                            wins++;
                        }
                    });


                    team.h2hPoints += wins;
                }
            });
        });


        sortedParticipants.sort((a, b) => b.h2hPoints - a.h2hPoints);


        sortedParticipants.forEach((participant, index) => {
            participant.rank = index + 1;
        });


        return sortedParticipants;
    }


    function clearHTML(headerTag, bodyTag) {
        const tableHeader = document.getElementById(headerTag);
        const tableBody = document.getElementById(bodyTag);


        tableHeader.innerHTML = '';
        tableBody.innerHTML = '';


        return [tableHeader, tableBody];
    }


    function updateDraftTable(participants) {
        const tableBody = document.getElementById('table-body');
        const tableHeader = document.getElementById('table-header');




        participants.forEach((participant, participantIndex) => {
            const th = tableHeader.children[participantIndex];
            th.innerText = `${participant.name} $${TOTAL_BUDGET - participant.spent}
                                     $${participant.maxBid} ${ROSTER_SIZE - participant.draftees}/${ROSTER_SIZE}`;
            participant.roster.forEach((playerData, rowIndex) => {
                if (playerData) {
                    const td = tableBody.rows[rowIndex].cells[participantIndex];
                    td.innerText = `${playerData.player.player} $${playerData.bid}`;
                }
            })
        })
    }


    function toggleBidInputVisibility(isVisible) {
        const bidInput = document.getElementById('bid-input');
        const submitButton = document.getElementById('submit-bid');


        if (isVisible) {
            bidInput.style.display = 'block';
            submitButton.style.display = 'block';
        } else {
            bidInput.style.display = 'none';
            submitButton.style.display = 'none';
        }
    }

    function updateUpperText(name, scenario) {
        const notif = document.getElementById('draft-notification');
        notif.innerText = `It is ${name}'s turn to ${scenario}.`
    }


    function waitForNomination(isAi) {
        return new Promise((resolve) => {
            const playerCardsContainer = document.getElementById('player-cards');

            if (isAi) {
                clearInterval(timer);
                resolve(null);
                return;
            }

            const nominationHandler = (event) => {
                if (event.target.matches('.nominate-button')) {
                    const playerId = Number(event.target.getAttribute('data-player-id'));
                    handleNomination(playerId);
                    resolve(playerId);
                    playerCardsContainer.removeEventListener('click', nominationHandler);
                    clearInterval(timer);
                }
            };

            playerCardsContainer.addEventListener('click', nominationHandler);
        });
    }

    /**
     * Handles the nomination of a player during the auction process.
     * 
     * If no player ID is provided, the function picks the top card from the 
     * player cards container. It then retrieves the nominated player's details 
     * from the dataset, updates the displayed player information, and hides 
     * the corresponding nomination button on the UI.
     * 
     * @param {number|null} playerId - The ID of the nominated player. If null, 
     *                                 the function picks the top player card.
     * @returns {number} - The ID of the nominated player.
     */
    function handleNomination(playerId) {
        if (playerId === null) {
            const playerCardsContainer = document.getElementById('player-cards');
            const topCard = pickTopCard(playerCardsContainer);
            playerId = Number(topCard.getAttribute('data-player-id'));
        }

        const nominatedPlayer = dataset.find(dataset => dataset.id === playerId);
        const heading = document.querySelector('.nominated-player-display h1');
        heading.innerText = `${nominatedPlayer.player} | ${nominatedPlayer.team}`;
        const positions = document.querySelector('.nominated-player-display p');
        positions.innerText = nominatedPlayer.pos;

        const playerCardsContainer = document.getElementById('player-cards');
        const card = Array.from(playerCardsContainer.getElementsByClassName('nominate-button'))
        .find(button => Number(button.getAttribute('data-player-id')) === playerId)
        .closest('.card');

        if (card) {
            card.style.display = 'none';
        }

        return playerId;
    }

    function pickTopCard(playerCardsContainer) {
        const cards = playerCardsContainer.querySelectorAll('.card');
            let topVisibleCard = null;
            for (let card of cards) {
                if (card.style.display != 'none') {
                    topVisibleCard = card;
                    break;
                }
            }
            return topVisibleCard.querySelector('.nominate-button');
    }


    function startTimer(seconds) {
        clearInterval(timer);
        let timeLeft = seconds;
        timer = setInterval(() => {
            if (timeLeft <= 0) {
                clearInterval(timer);
            } else {
                timeLeft--;
                const clock = document.querySelector('#timer p');
                const formattedTime = `0:${timeLeft < 10 ? '0' : ''}${timeLeft}`;
                clock.innerText = formattedTime;
                if (timeLeft <= 6) {
                    clock.style.color = 'red';
                }
            }
        }, 1000);
    }

    /**
     * Initiates the bidding process for a given bidder and player.
     *
     * The function updates the UI with the current bidder's name, sets the
     * initial bid value based on whether the current bidder is the nominator,
     * and handles both AI and human bidders. It sets a timer for the bidding
     * duration and resolves a promise once a bid is submitted.
     *
     * @param {Participant} currentBidder - The participant currently placing the bid.
     * @param {number} id - The ID of the player being bid on.
     * @param {boolean} isNominator - Indicates whether the current bidder is the nominator.
     * @returns {Promise<void>} - A promise that resolves when the bidding process is complete.
     */
    async function startBid(currentBidder, id, isNominator) {
        updateUpperText(currentBidder.name, "bid");
        const bid = document.getElementById('bid-input');
        const submitButton = document.getElementById('submit-bid');
        let submitted = false;
        bid.value = isNominator ? 1 : 0;


        startTimer(BIDDING_TIME);


        if (currentBidder.isAi) {
            return new Promise((resolve) => {
                setTimeout(() => {
                    currentBidder.placeBid(determineValue(currentBidder, id, isNominator));
                    submitted = true;
                    resolve();
                }, 5000);
                return;
            });
        }


        return new Promise((resolve) => {
            const handleBidSubmit = () => {
                const currentBidAmount = parseInt(bid.value) || (isNominator ? 1 :0);
                currentBidder.placeBid(currentBidAmount);
                submitted = true;
                clearTimeout(timeoutId);
                resolve();
            };


            const timeoutId = setTimeout(() => {
                if (!submitted) {
                    const currentBidAmount = parseInt(bid.value) || (isNominator ? 1 : 0);
                    currentBidder.placeBid(currentBidAmount);
                    submitted = true;
                    resolve();
                }
            }, BIDDING_TIME * 1000);


            submitButton.onclick = handleBidSubmit;
        });
    }

    /**
     * Determines the bidding value spent by AI for a player based on various factors, 
     * including the current bidder's stats, aggression, and league size.
     *
     * The function calculates a score that reflects the player's value to 
     * the current bidder, taking into account performance metrics and other 
     * contextual factors. It also ensures the calculated value does not exceed 
     * the current bidder's maximum bid.
     *
     * @param {Participant} currentBidder - The AI determining the bid value.
     * @param {number} id - The ID of the player for whom the bid value is being determined.
     * @param {boolean} isNominator - Indicates if the current bidder is the nominator.
     * @returns {number} - The calculated bidding value for the player, capped at the current bidder's max bid.
     */
    function determineValue(currentBidder, id, isNominator) {
        if (currentBidder.draftees == ROSTER_SIZE) return 0;


        let leagueMultiplier = 1;


        if (currentBidder.aggression < 55 && leagueSize <= 12) {
            leagueMultiplier = 1.05 + 0.39 * (leagueSize / 12);
        } else if (leagueSize <= 12) {
            leagueMultiplier = 1.1;
        } else if (leagueSize >= 16 && currentBidder.aggression > 55) {
            leagueMultiplier = .87;
        }


        const leagueAggression = Math.round(Math.pow(0.04911 * leagueSize, 2) - (0.3964 * leagueSize)
        + (currentBidder.aggression * leagueMultiplier));

        const budgetFactor = (TOTAL_BUDGET - currentBidder.spent) / TOTAL_BUDGET;
        const rosterFactor = (ROSTER_SIZE - currentBidder.draftees) / ROSTER_SIZE;
        const max_value = Math.max(0, leagueAggression + Math.floor(Math.random() * 9) - 3.3);


        const good_fg_pct = 0.55;
        const good_ft_pct = 0.87;
        const good_tos = 1.5;
        const high_vol_fg = 9.8;
        const high_vol_ft = 3.5;
        let popcorn_val = 0;


        const player = dataset.find(player => player.id === id);
        const grades = [];
        let totalScore = 0;


        grades.push(evaluateContribution(player.ppg, 20, 0.3, 17.5));
        grades.push(1.5 * evaluateContribution(player.apg, 12, 0.7, 4));
        let rebVal = evaluateContribution(player.rpg, 12, 0.7, 5)


        if (rebVal < 3) {
            grades.push(0);
        } else {
            grades.push(1.5 * (rebVal >= 5 ? rebVal : rebVal / 3));
        }


        popcorn_val += (grades[0] + grades[1] + grades[2]) / 30;


        let ft = Math.min(8, 8 - (40 * (good_ft_pct - player.ft_pct)));
        ft *= evaluateContribution(player.fta, 1, 0.8, 3);


        if (ft > 6.5 && player.fta >= high_vol_ft) {
            totalScore += 2;
        } else if (ft < 3 && player.fta > high_vol_ft) {
            totalScore -= 4;
        } else if (ft < 3.2) {
            totalScore -= 2;
        }


        grades.push(ft);


        let fg = Math.min(10, 10 - (50 * (good_fg_pct - player.fg_pct)));


        if (player.fga <= 10) {
            fg *= evaluateContribution(player.fga, 1, .25, 6);
        }


        if (fg > 10 && player.fga > high_vol_fg || player.fg_pct >= .57 && player.fga >= 7) {
            totalScore += 2;
        } else if (fg < 8 && player.fga > high_vol_fg) {
            totalScore -= 4;
        } else if (fg < 8.5 && player.fga > 5) {
            totalScore -= 2;
        }


        grades.push(fg);


        if (player.three_p >= 0.8) {
            grades.push(1.333 * evaluateContribution(player.three_p, 6, 0.6, 0));
        } else {
            grades.push(evaluateContribution(player.three_p, 0.8, 0.6, 0.4));
        }


        if (player.spg >= 1.68) {
            totalScore += 6 * (Math.max( 0.5, popcorn_val));
        } else if (player.spg >= 1.4) {
            totalScore += 4.2 * (Math.max(0.5, popcorn_val))
        } else if (player.spg >= 1) {
            totalScore += 2 * (Math.max(0.5, popcorn_val));
        } else if (player.spg >= 0.7) {
            totalScore += 1.2 * (Math.max(0.5, popcorn_val));
        }


        if (player.bpg >= 3) {
            totalScore += 8;
        } else if (player.bpg >= 2) {
            totalScore += 5 * (Math.max(0.7, popcorn_val));
        } else if (player.bpg >= 1.5) {
            totalScore += 4 * (Math.max(0.7, popcorn_val));
        } else if (player.bpg >= 1.15) {
            totalScore += 3 * (Math.max(0.7, popcorn_val));
        } else if (player.bpg >= 0.75) {
            totalScore += 1.4 * (Math.max(0.7, popcorn_val));
        }

        totalScore += grades.reduce((sum, value) => sum + value, 0);

        if (totalScore <= 9) {
            totalScore /= 15;
        }

        if (player.tos <= good_tos && player.totalScore >= 10) {
            totalScore += 1;
        }

        if (player.games < 55) {
        totalScore *= 0.8;
        }

        if (isNominator && totalScore < 1) {
            totalScore = 1;
        }

        let worth = Math.round(Math.min(totalScore, max_value));
        return Math.min(worth, currentBidder.maxBid);
    }

    /**
     * Evaluates the contribution of a specific stat using a logistic growth function.
     *
     * The function calculates a grade for the stat based on its value compared 
     * to a peak, players that are elite at a certain stat are valued highly, non-contributors
     * are punished heavily in value and middling players have a more stable shift in value as their 
     * contribution goes up.
     *
     * @param {number} stat - The current value of the statistic being evaluated.
     * @param {number} peak - The maximum possible contribution value for the stat.
     * @param {number} curve - The steepness of the curve; higher values result in 
     *                         a sharper transition around the turning point.
     * @param {number} turn - The point at which the contribution begins to rise 
     *                        significantly.
     * @returns {number} - The calculated grade for the contribution based on 
     *                     the provided stat.
     */
    function evaluateContribution(stat, peak, curve, turn) {
        const grade = peak / (1 + Math.exp(-curve * (stat - turn)));
        return grade;
    }

    function selectHighestBid(participants, id) {
        /*participants = randomizeArray(participants);*/

        const highestBid = Math.max(...participants.map(participant => participant.currentBid));
        const highestBidders = participants.filter(participant => participant.currentBid === highestBid);
        const winner = highestBidders[Math.floor(Math.random() * highestBidders.length)];

        winner.spent += winner.currentBid;
        winner.addPlayer(id, winner.currentBid);
        updateStatsTable(participants);
        const bid = document.getElementById('bid-input');
        bid.value = 0;
    }


    /* TODO:
            fix the top banner info. it keeps talking about turn to nominate.
            might already be fixed on other computer.
            implement page where you can look at cumulative stats and rankings per roster
            have bots account for all 9 cat
            ^ volume should affect percentage value
            fix css for table so everything is fairly visible
            need to fix table since player that played for multiple teams are repeated
            need at least 310 unique players since leagues can be up to 20 in size
            maybe if bots can also account for how much roster they have to fill
    */
});
