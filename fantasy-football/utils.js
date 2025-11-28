/**
 * Fantasy Football Utility Functions
 * Helper functions for team data, calculations, and data transformations
 */

/**
 * Get team name by ID
 * @param {number} teamId - Team ID
 * @param {Array} teams - Array of team objects
 * @returns {string} Team name
 */
function getTeamName(teamId, teams) {
    const team = teams.find(t => t.id === teamId);
    if (!team) return `Team ${teamId}`;
    return team.name || team.abbreviation || `Team ${teamId}`;
}

/**
 * Get team name from team object (handles npm package structure)
 * @param {Object} team - Team object
 * @returns {string} Team name
 */
function getTeamNameFromObject(team) {
    if (!team) return 'Unknown Team';
    return team.name || team.abbreviation || `Team ${team.id}`;
}

/**
 * Get team total points (handles npm package structure)
 * @param {Object} team - Team object
 * @returns {number} Total points
 */
function getTeamTotalPoints(team) {
    if (!team) return 0;
    return team.totalPointsScored || team.regularSeasonPointsFor || team.totalPoints || 0;
}

/**
 * Calculate points against for a team
 * @param {number} teamId - Team ID
 * @param {Array} matchups - Array of matchup objects
 * @param {Array} teams - Array of team objects (unused but kept for API compatibility)
 * @returns {number} Average points against
 */
function calculatePointsAgainst(teamId, matchups, teams) {
    let totalPA = 0;
    let games = 0;
    
    matchups.forEach(matchup => {
        if (matchup.homeTeamId === teamId) {
            totalPA += matchup.awayScore || 0;
            games++;
        } else if (matchup.awayTeamId === teamId) {
            totalPA += matchup.homeScore || 0;
            games++;
        }
    });
    
    return games > 0 ? totalPA / games : 0;
}

/**
 * Calculate consistency (standard deviation) of scores
 * @param {Array<number>} scores - Array of scores
 * @returns {number} Standard deviation
 */
function calculateConsistency(scores) {
    if (scores.length === 0) return 0;
    
    const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
    const variance = scores.reduce((sum, score) => sum + Math.pow(score - mean, 2), 0) / scores.length;
    return Math.sqrt(variance);
}

/**
 * Calculate average of an array of numbers
 * @param {Array<number>} numbers - Array of numbers
 * @returns {number} Average value
 */
function calculateAverage(numbers) {
    if (numbers.length === 0) return 0;
    return numbers.reduce((a, b) => a + b, 0) / numbers.length;
}

/**
 * Get all teams from season data
 * @param {Object} allSeasonsData - Data for all seasons
 * @returns {Set} Set of unique team objects (as JSON strings)
 */
function getAllTeams(allSeasonsData) {
    const teams = new Set();
    Object.values(allSeasonsData).forEach(seasonData => {
        (seasonData.mTeam || []).forEach(team => {
            teams.add(JSON.stringify({ id: team.id, name: getTeamNameFromObject(team) }));
        });
    });
    return Array.from(teams).map(t => JSON.parse(t));
}

/**
 * Get matchups from season data
 * @param {Object} seasonData - Single season data
 * @returns {Array} Array of matchup objects
 */
function getMatchups(seasonData) {
    return seasonData?.mMatchup?.schedule || [];
}

/**
 * Get teams from season data
 * @param {Object} seasonData - Single season data
 * @returns {Array} Array of team objects
 */
function getTeams(seasonData) {
    return Array.isArray(seasonData?.mTeam) ? seasonData.mTeam : [];
}

export {
    getTeamName,
    getTeamNameFromObject,
    getTeamTotalPoints,
    calculatePointsAgainst,
    calculateConsistency,
    calculateAverage,
    getAllTeams,
    getMatchups,
    getTeams
};

