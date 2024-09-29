const playerData = require('../sample.json');

describe("JSON Structure Validation", () => {
    test("should have required fields", () => {
        playerData.forEach(player => {
            expect(player).toHaveProperty("player");
            expect(player).toHaveProperty("ppg");
            expect(player).toHaveProperty("apg");
            expect(player).toHaveProperty("rpg");
            expect(player).toHaveProperty("team");
            expect(player).toHaveProperty("pos");

            expect(typeof player.player).toBe("string");
            expect(typeof player.ppg).toBe("number");
            expect(typeof player.apg).toBe("number");
            expect(typeof player.rpg).toBe("number");
            expect(typeof player.team).toBe("string");
            expect(typeof player.pos).toBe("string");
        });
    });
});