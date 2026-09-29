const API = "https://mempool.space/api";

const walletInput = document.getElementById("walletInput");
const trackBtn = document.getElementById("trackBtn");
const statusText = document.getElementById("statusText");

const results = document.getElementById("results");
const walletAddress = document.getElementById("walletAddress");

const txCount = document.getElementById("txCount");
const received = document.getElementById("received");
const sent = document.getElementById("sent");
const balance = document.getElementById("balance");

const riskLevel = document.getElementById("riskLevel");
const riskList = document.getElementById("riskList");

const linkedCount = document.getElementById("linkedCount");
const linkedWallets = document.getElementById("linkedWallets");

const transactionTable = document.getElementById("transactionTable");
const downloadBtn = document.getElementById("downloadBtn");

let currentReport = null;
trackBtn.addEventListener('click', async function() {
    const address = walletInput.value.trim();
    
    if (address === "") {
        alert("Please enter a Bitcoin wallet address!");
        return;
    }

    statusText.innerText = "Investigating...";
    
    if (walletAddress) {
        walletAddress.innerText = address;
    }

    if (results) {
        results.classList.remove('hidden');
    }

    statusText.innerText = "Investigation complete!";
});

// Convert satoshis to BTC
function satToBTC(value) {
    return (value / 100000000).toFixed(8);
}


// Shorten long transaction/address strings
function shorten(value, start = 10, end = 8) {
    if (!value) return "—";
    if (value.length <= start + end) return value;
    return value.slice(0, start) + "..." + value.slice(-end);
}


// Format date
function formatDate(timestamp) {
    if (!timestamp) return "Unconfirmed";

    return new Date(timestamp * 1000).toLocaleString();
}


// Update status message
function setStatus(message) {
    statusText.textContent = message;
}


// Validate Bitcoin address
async function validateAddress(address) {

    const response = await fetch(
        `${API}/v1/validate-address/${encodeURIComponent(address)}`
    );

    if (!response.ok) {
        throw new Error("Address validation failed");
    }

    return await response.json();
}


// Get wallet information
async function getAddressData(address) {

    const response = await fetch(
        `${API}/address/${encodeURIComponent(address)}`
    );

    if (!response.ok) {
        throw new Error("Wallet data could not be loaded");
    }

    return await response.json();
}


// Get transaction history
async function getTransactions(address) {

    const response = await fetch(
        `${API}/address/${encodeURIComponent(address)}/txs`
    );

    if (!response.ok) {
        throw new Error("Transaction history could not be loaded");
    }

    return await response.json();
}


// Find addresses appearing in the same transactions
function findLinkedWallets(transactions, targetAddress) {

    const links = new Map();

    transactions.forEach(tx => {

        tx.vin?.forEach(input => {

            const address = input.prevout?.scriptpubkey_address;

            if (
                address &&
                address !== targetAddress
            ) {
                links.set(
                    address,
                    (links.get(address) || 0) + 1
                );
            }
        });


        tx.vout?.forEach(output => {

            const address = output.scriptpubkey_address;

            if (
                address &&
                address !== targetAddress
            ) {
                links.set(
                    address,
                    (links.get(address) || 0) + 1
                );
            }
        });

    });


    return [...links.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8);
}


// Analyze basic on-chain indicators
function analyzeRisk(addressData, transactions, links) {

    const indicators = [];

    const stats = addressData.chain_stats;

    const totalTx =
        stats.tx_count +
        addressData.mempool_stats.tx_count;

    const balanceSats =
        stats.funded_txo_sum -
        stats.spent_txo_sum;


    if (totalTx >= 100) {

        indicators.push({
            label: "High transaction activity",
            value: "WATCH",
            className: "risk-watch"
        });

    } else {

        indicators.push({
            label: "Transaction activity",
            value: "NORMAL",
            className: "risk-good"
        });

    }


    if (links.length >= 5) {

        indicators.push({
            label: "Multiple connected addresses observed",
            value: "WATCH",
            className: "risk-watch"
        });

    } else {

        indicators.push({
            label: "Direct wallet connections",
            value: "LIMITED",
            className: "risk-good"
        });

    }


    if (balanceSats === 0) {

        indicators.push({
            label: "Current balance",
            value: "ZERO",
            className: "risk-good"
        });

    } else {

        indicators.push({
            label: "Current balance",
            value: "ACTIVE",
            className: "risk-watch"
        });

    }


    return indicators;
}


// Display risk indicators
function renderRisk(indicators) {

    riskList.innerHTML = "";

    indicators.forEach(item => {

        const row = document.createElement("div");

        row.className = "risk-item";

        row.innerHTML = `
            <span>${item.label}</span>
            <strong class="${item.className}">
                ${item.value}
            </strong>
        `;

        riskList.appendChild(row);

    });


    const watchCount =
        indicators.filter(
            item => item.className === "risk-watch"
        ).length;


    if (watchCount >= 2) {

        riskLevel.textContent = "REVIEW";

    } else {

        riskLevel.textContent = "LOW SIGNAL";

    }
}


// Display linked wallets
function renderLinkedWallets(links) {

    linkedWallets.innerHTML = "";

    linkedCount.textContent =
        `${links.length} found`;


    if (!links.length) {

        linkedWallets.innerHTML =
            "<p>No linked addresses found in the analyzed transactions.</p>";

        return;
    }


    links.forEach(([address, count]) => {

        const item =
            document.createElement("div");

        item.className =
            "linked-address";

        item.innerHTML = `
            <strong>${shorten(address, 16, 12)}</strong>
            <br>
            <span>${count} transaction connection(s)</span>
        `;

        linkedWallets.appendChild(item);

    });
}


// Display transactions
function renderTransactions(transactions) {

    transactionTable.innerHTML = "";

    transactions
        .slice(0, 15)
        .forEach(tx => {

            let total = 0;

            tx.vout?.forEach(output => {

                total += output.value || 0;

            });


            const row =
                document.createElement("tr");


            const status =
                tx.status?.confirmed
                    ? "Confirmed"
                    : "Pending";


            row.innerHTML = `
                <td>
                    <span class="tx-link">
                        ${shorten(tx.txid)}
                    </span>
                </td>

                <td>
                    ${formatDate(tx.status?.block_time)}
                </td>

                <td>
                    ${satToBTC(total)} BTC
                </td>

                <td>
                    ${status}
                </td>
            `;


            transactionTable.appendChild(row);

        });
}


// Main investigation
async function investigateWallet() {

    const address =
        walletInput.value.trim();


    if (!address) {

        setStatus("Please enter a Bitcoin wallet address.");

        walletInput.focus();

        return;
    }


    trackBtn.disabled = true;

    trackBtn.textContent =
        "Investigating...";


    results.classList.add("hidden");


    try {

        setStatus("Validating Bitcoin address...");

        const validation =
            await validateAddress(address);


        if (!validation.isvalid) {

            throw new Error(
                "The entered Bitcoin address is not valid."
            );

        }


        setStatus("Fetching blockchain activity...");

        const addressData =
            await getAddressData(address);


        setStatus("Loading transaction history...");

        const transactions =
            await getTransactions(address);


        setStatus("Analyzing transaction links...");

        const links =
            findLinkedWallets(
                transactions,
                address
            );


        const indicators =
            analyzeRisk(
                addressData,
                transactions,
                links
            );


        const stats =
            addressData.chain_stats;


        const totalReceived =
            stats.funded_txo_sum;


        const totalSent =
            stats.spent_txo_sum;


        const currentBalance =
            totalReceived -
            totalSent;


        walletAddress.textContent =
            address;


        txCount.textContent =
            (
                stats.tx_count +
                addressData.mempool_stats.tx_count
            ).toLocaleString();


        received.textContent =
            satToBTC(totalReceived);


        sent.textContent =
            satToBTC(totalSent);


        balance.textContent =
            satToBTC(currentBalance);


        renderRisk(indicators);

        renderLinkedWallets(links);

        renderTransactions(transactions);


        currentReport = {
            address,
            analyzedAt: new Date().toLocaleString(),
            transactionCount:
                stats.tx_count +
                addressData.mempool_stats.tx_count,
            totalReceived: satToBTC(totalReceived),
            totalSent: satToBTC(totalSent),
            balance: satToBTC(currentBalance),
            linkedWallets: links,
            indicators
        };


        results.classList.remove("hidden");

        setStatus(
            "Investigation completed using public Bitcoin blockchain data."
        );

    } catch (error) {

        console.error(error);

        setStatus(
            error.message ||
            "Something went wrong while analyzing the wallet."
        );

    } finally {

        trackBtn.disabled = false;

        trackBtn.textContent =
            "Start Investigation";
    }
}


// Download investigation report
function downloadReport() {

    if (!currentReport) {

        setStatus(
            "Run an investigation before downloading the report."
        );

        return;
    }


    const report = `
TRACECHAIN:AI
BITCOIN BLOCKCHAIN INVESTIGATION REPORT
=======================================

Wallet:
${currentReport.address}

Analyzed:
${currentReport.analyzedAt}

Transaction Count:
${currentReport.transactionCount}

Total Received:
${currentReport.totalReceived} BTC

Total Sent:
${currentReport.totalSent} BTC

Current Balance:
${currentReport.balance} BTC


RISK / ON-CHAIN INDICATORS
--------------------------

${currentReport.indicators
    .map(
        item =>
            `${item.label}: ${item.value}`
    )
    .join("\n")}


LINKED WALLET ADDRESSES
-----------------------

${currentReport.linkedWallets
    .map(
        ([address, count]) =>
            `${address} | ${count} connection(s)`
    )
    .join("\n")}


IMPORTANT NOTICE
----------------

This report is based on publicly available
Bitcoin blockchain data.

On-chain indicators do not independently
establish fraud, criminal activity, ownership
or intent.

Further investigation and verification are
required before drawing conclusions.


Data source:
Mempool.space public Bitcoin REST API
`;


    const blob =
        new Blob(
            [report],
            { type: "text/plain" }
        );


    const url =
        URL.createObjectURL(blob);


    const link =
        document.createElement("a");


    link.href = url;

    link.download =
        "TraceChain-Investigation-Report.txt";


    document.body.appendChild(link);

    link.click();

    link.remove();

    URL.revokeObjectURL(url);
}


// Button events
trackBtn.addEventListener(
    "click",
    investigateWallet
);


walletInput.addEventListener(
    "keydown",
    event => {

        if (event.key === "Enter") {

            investigateWallet();

        }

    }
);


downloadBtn.addEventListener(
    "click",
    downloadReport
);
