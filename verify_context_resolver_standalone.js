
// Mock SessionManager
const mockSessionManager = {
    adapter: {
        isReady: () => true,
        get: async (store, id) => {
            if (store === 'sessions' && id === 'session-1') {
                return { lastTurnId: 'turn-1' };
            }
            if (store === 'turns' && id === 'turn-1') {
                return {
                    id: 'turn-1',
                    providerContexts: {
                        claude: { meta: { conversationId: 'claude-id' } },
                        gpt4: { conversationId: 'gpt4-id' } // Legacy shape test
                    }
                };
            }
            return null;
        }
    }
};

// Copied ContextResolver Class (simplified for verification)
class ContextResolver {
    constructor(sessionManager) {
        this.sessionManager = sessionManager;
    }

    async resolve(request) {
        if (!request || !request.type) {
            throw new Error("[ContextResolver] request.type is required");
        }

        switch (request.type) {
            case "initialize":
                return this._resolveInitialize(request);
            case "extend":
                return this._resolveExtend(request);
            case "recompute":
                return this._resolveRecompute(request);
            default:
                throw new Error(
                    `[ContextResolver] Unknown request type: ${request.type}`,
                );
        }
    }

    async _resolveInitialize(request) {
        return {
            type: "initialize",
            providers: request.providers || [],
        };
    }

    async _resolveExtend(request) {
        const sessionId = request.sessionId;
        if (!sessionId)
            throw new Error("[ContextResolver] Extend requires sessionId");

        const session = await this._getSessionMetadata(sessionId);
        if (!session || !session.lastTurnId) {
            throw new Error(
                `[ContextResolver] Cannot extend: no lastTurnId for session ${sessionId}`,
            );
        }

        const lastTurn = await this._getTurn(session.lastTurnId);
        if (!lastTurn)
            throw new Error(
                `[ContextResolver] Last turn ${session.lastTurnId} not found`,
            );

        const turnContexts = lastTurn.providerContexts || {};
        const normalized = {};
        for (const [pid, ctx] of Object.entries(turnContexts)) {
            normalized[pid] = ctx && ctx.meta ? ctx.meta : ctx;
        }

        // PERMISSIVE EXTEND LOGIC (The logic being tested)
        const resolvedContexts = {};
        const forcedResetSet = new Set(request.forcedContextReset || []);

        for (const pid of (request.providers || [])) {
            if (forcedResetSet.has(pid)) {
                // Case 1: Forced Reset
                resolvedContexts[pid] = { isNewJoiner: true };
            } else if (normalized[pid]) {
                // Case 2: Context Exists -> Continue
                resolvedContexts[pid] = normalized[pid];
            } else {
                // Case 3: No Context -> New Joiner
                resolvedContexts[pid] = { isNewJoiner: true };
            }
        }

        return {
            type: "extend",
            sessionId,
            lastTurnId: lastTurn.id,
            providerContexts: resolvedContexts,
        };
    }

    async _resolveRecompute(request) {
        return {}; // Not testing recompute
    }

    async _getSessionMetadata(sessionId) {
        return await this.sessionManager.adapter.get("sessions", sessionId);
    }

    async _getTurn(turnId) {
        return await this.sessionManager.adapter.get("turns", turnId);
    }
}

const resolver = new ContextResolver(mockSessionManager);

async function runTests() {
    console.log('--- Starting ContextResolver Verification ---');

    // Test 1: Extend with existing provider
    console.log('\nTest 1: Extend with existing provider (claude)');
    const res1 = await resolver.resolve({
        type: 'extend',
        sessionId: 'session-1',
        providers: ['claude']
    });
    if (res1.providerContexts.claude.conversationId === 'claude-id') {
        console.log('PASS: Claude context preserved');
    } else {
        console.error('FAIL: Claude context lost', res1.providerContexts);
    }

    // Test 2: Extend with new provider (gemini)
    console.log('\nTest 2: Extend with new provider (gemini)');
    const res2 = await resolver.resolve({
        type: 'extend',
        sessionId: 'session-1',
        providers: ['gemini']
    });
    if (res2.providerContexts.gemini.isNewJoiner === true) {
        console.log('PASS: Gemini marked as new joiner');
    } else {
        console.error('FAIL: Gemini not marked correctly', res2.providerContexts);
    }

    // Test 3: Extend with mixed (claude + gemini)
    console.log('\nTest 3: Extend with mixed (claude + gemini)');
    const res3 = await resolver.resolve({
        type: 'extend',
        sessionId: 'session-1',
        providers: ['claude', 'gemini']
    });
    if (res3.providerContexts.claude.conversationId === 'claude-id' &&
        res3.providerContexts.gemini.isNewJoiner === true) {
        console.log('PASS: Mixed contexts correct');
    } else {
        console.error('FAIL: Mixed contexts incorrect', res3.providerContexts);
    }

    // Test 4: Forced Reset (claude)
    console.log('\nTest 4: Forced Reset (claude)');
    const res4 = await resolver.resolve({
        type: 'extend',
        sessionId: 'session-1',
        providers: ['claude'],
        forcedContextReset: ['claude']
    });
    if (res4.providerContexts.claude.isNewJoiner === true) {
        console.log('PASS: Claude forced reset successful');
    } else {
        console.error('FAIL: Claude forced reset failed', res4.providerContexts);
    }

    console.log('\n--- Verification Complete ---');
}

runTests().catch(console.error);
