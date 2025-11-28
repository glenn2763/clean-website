/**
 * Transaction Analysis Component
 * Shows waiver claims, trades, and roster moves
 */

import { getTeamNameFromObject, getTeams } from '../utils.js';
import { createChart } from '../charts.js';

/**
 * Render transaction analysis chart and table
 * @param {Object} allSeasonsData - Data for all seasons
 */
function renderTransactionAnalysis(allSeasonsData) {
    const canvas = document.getElementById('transactions-chart');
    if (!canvas) return;
    
    const transactionCounts = {};
    
    Object.values(allSeasonsData).forEach(seasonData => {
        const transactions = seasonData?.mTransactions?.transactions || [];
        const teams = getTeams(seasonData);
        
        if (!Array.isArray(transactions)) return;
        
        transactions.forEach(transaction => {
            const teamId = transaction.teamId;
            const team = teams.find(t => t.id === teamId);
            if (team) {
                const name = getTeamNameFromObject(team);
                if (!transactionCounts[name]) {
                    transactionCounts[name] = { waivers: 0, trades: 0, drops: 0 };
                }
                
                if (transaction.type === 'WAIVER') transactionCounts[name].waivers++;
                else if (transaction.type === 'TRADE') transactionCounts[name].trades++;
                else if (transaction.type === 'DROP') transactionCounts[name].drops++;
            }
        });
    });
    
    const sorted = Object.entries(transactionCounts)
        .map(([name, counts]) => ({ 
            name, 
            total: counts.waivers + counts.trades + counts.drops,
            ...counts 
        }))
        .sort((a, b) => b.total - a.total);
    
    createChart('transactions', canvas, {
        type: 'bar',
        data: {
            labels: sorted.map(t => t.name),
            datasets: [
                {
                    label: 'Waivers',
                    data: sorted.map(t => t.waivers),
                    backgroundColor: 'rgba(33, 150, 243, 0.6)',
                    borderColor: 'rgba(33, 150, 243, 1)'
                },
                {
                    label: 'Trades',
                    data: sorted.map(t => t.trades),
                    backgroundColor: 'rgba(156, 39, 176, 0.6)',
                    borderColor: 'rgba(156, 39, 176, 1)'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: { display: true, text: 'Transaction Activity by Team' },
                legend: { position: 'top' }
            },
            scales: {
                y: { beginAtZero: true, title: { display: true, text: 'Count' } }
            }
        }
    });
    
    document.getElementById('transactions-table').innerHTML = `
        <table>
            <thead>
                <tr>
                    <th>Team</th>
                    <th>Waivers</th>
                    <th>Trades</th>
                    <th>Total</th>
                </tr>
            </thead>
            <tbody>
                ${sorted.map(team => `
                    <tr>
                        <td>${team.name}</td>
                        <td>${team.waivers}</td>
                        <td>${team.trades}</td>
                        <td><strong>${team.total}</strong></td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

export { renderTransactionAnalysis };

