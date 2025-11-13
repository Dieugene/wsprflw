# Module Manager Specification v2.0.0

**Date:** 2025-11-12 (Updated)
**Role:** Architect
**Issue:** Multiple instances of stateful modules created across codebase
**Severity:** 🔴 CRITICAL - Data inconsistency, memory leaks, race conditions

**v2.0.0 Changes:**
- ✅ Individual loader functions instead of universal get(name)
- ✅ JSDoc type annotations for IDE autocomplete
- ✅ Initialization inside factory functions
- ✅ Removed class passing through loader

---

## 1. Problem Analysis

### Current Issues

#### 1.1 Multiple queuer Instances
```javascript
// index.js:15
const queuer = require("@dieugene/queuer")();  // Instance #1

// timer-handler.js:19
const queuer = require("@dieugene/queuer")();  // Instance #2 ❌
```

**Impact:** Different queue instances cannot share state, leading to:
- Messages sent to different queues
- Lost coordination between modules
- Duplicate processing

#### 1.2 Multiple users.init() Calls
```javascript
// timer-handler.js:29
users.init();  // Called here

// index.js
// NOT called ❌
```

**Impact:**
- Undefined behavior if init() called multiple times
- Race conditions during initialization
- Database connection pool issues

#### 1.3 Missing I.updateStringPrototype()
```javascript
// index.js:38
I.updateStringPrototype();  // Called here

// timer-handler.js - NOT called
// Other modules - NOT called
```

**Impact:**
- String extensions not available in some modules
- Runtime errors when using custom string methods
- Inconsistent API across modules

#### 1.4 Multiple bot (Telegraf) Instances
```javascript
// Potentially created in multiple places
const bot = new Telegraf(bot_token);
```

**Impact:**
- Multiple webhook registrations
- Memory waste
- Telegram API rate limiting issues

---

## 2. Module Categories

### 2.1 Stateful Singletons (MUST be single instance)

| Module | Initialization | Reason |
|--------|---------------|---------|
| **queuer** | `require("@dieugene/queuer")()` | Shared queue state |
| **sessions** | `require('@dieugene/sessions')` | User session tracking |
| **tg_cache** | `require("@dieugene/tg-messages-cache")` | Message cache state |
| **users** | `require("@dieugene/users-controller")` + `.init()` | DB connection pool |
| **logger** | `require("@dieugene/logger")(bot_domain)` | Log aggregation |
| **bot** | `new Telegraf(bot_token)` | Telegram connection |
| **I (utils)** | `require("@dieugene/utils")` + `.updateStringPrototype()` | Global extensions |

### 2.2 Factory Modules (New instance per usage)

| Module | Usage Pattern | Reason |
|--------|--------------|---------|
| **Dialog** | `new Dialog(...)` per user | User-specific state |
| **YdbChatMessageHistory** | `new YdbChatMessageHistory(...)` | Per-user history |
| **ChatOpenAI** | `new ChatOpenAI(...)` | Per-request model |

### 2.3 Stateless Libraries (Safe to import anywhere)

- `@langchain/core` types (HumanMessage, AIMessage, SystemMessage)
- `telegraf` types (Context, Markup)
- `zod`, `date-fns`, `ydb-sdk`

---

## 3. Proposed Solution: Lazy Singleton Module Manager

### 3.1 Architecture Overview

```
┌─────────────────────────────────────────────┐
│         Application Entry Point              │
│              (index.js)                      │
└────────────────┬────────────────────────────┘
                 │
                 │ imports
                 ▼
┌─────────────────────────────────────────────┐
│         Module Manager (modules.js)          │
│  ┌──────────────────────────────────────┐   │
│  │  Singleton Registry (private)         │   │
│  │  {                                    │   │
│  │    queuer: null,                      │   │
│  │    sessions: null,                    │   │
│  │    users: null,                       │   │
│  │    ...                                │   │
│  │  }                                    │   │
│  └──────────────────────────────────────┘   │
│                                              │
│  Public API:                                 │
│  - modules.users()   ← Individual functions  │
│  - modules.queuer()     with type hints      │
│  - modules.sessions()                        │
│  - modules.utils()                           │
└────────────────┬────────────────────────────┘
                 │
                 │ used by
                 ▼
┌─────────────────────────────────────────────┐
│       Application Modules                    │
│  - dialog-system.js                          │
│  - timer-handler.js                          │
│  - workspace-manager.js                      │
│  - reports-bus.js                            │
│  - etc.                                      │
└─────────────────────────────────────────────┘
```

### 3.2 Implementation Pattern - Individual Loaders with Type Hints

#### File: `src/core/modules.js`

```javascript
/**
 * Centralized Module Manager with Individual Loaders
 * Ensures singleton pattern for stateful modules
 * Provides IDE autocomplete via JSDoc type annotations
 *
 * @module modules
 * @version 2.0.0
 */

// Type definitions for IDE autocomplete
/**
 * @typedef {import('@dieugene/users-controller')} UsersController
 * @typedef {import('@dieugene/queuer')} Queuer
 * @typedef {import('@dieugene/sessions')} Sessions
 * @typedef {import('@dieugene/tg-messages-cache')} TgCache
 * @typedef {import('@dieugene/utils')} Utils
 * @typedef {import('@dieugene/logger')} Logger
 * @typedef {import('telegraf').Telegraf} TelegrafBot
 */

const bot_token = process.env.TELEGRAM_BOT_TOKEN;
const bot_domain = process.env.BOT_NAME;

// Private singleton registry
const _instances = {};

/**
 * Lazy-load and cache module instance
 * @private
 * @template T
 * @param {string} name - Module name
 * @param {() => T} factory - Factory function
 * @returns {T} Module instance
 */
function _getOrCreate(name, factory) {
    if (!_instances[name]) {
        console.log(`[MODULES] Initializing singleton: ${name}`);
        _instances[name] = factory();
    }
    return _instances[name];
}

/**
 * Module Manager - Public API with Individual Loaders
 */
const modules = {

    /**
     * Get users controller singleton (auto-initialized)
     * @returns {UsersController}
     */
    users() {
        return _getOrCreate('users', () => {
            const users = require("@dieugene/users-controller");
            // Initialize users controller on first load
            users.init();
            console.log('[MODULES] ✅ users.init() called');
            return users;
        });
    },

    /**
     * Get queuer singleton
     * @returns {Queuer}
     */
    queuer() {
        return _getOrCreate('queuer', () => {
            return require("@dieugene/queuer")();
        });
    },

    /**
     * Get sessions singleton
     * @returns {Sessions}
     */
    sessions() {
        return _getOrCreate('sessions', () => {
            return require('@dieugene/sessions');
        });
    },

    /**
     * Get Telegram cache singleton
     * @returns {TgCache}
     */
    tg_cache() {
        return _getOrCreate('tg_cache', () => {
            return require("@dieugene/tg-messages-cache");
        });
    },

    /**
     * Get utils singleton (auto-initializes String prototype)
     * Alias: I()
     * @returns {Utils}
     */
    utils() {
        return _getOrCreate('utils', () => {
            const I = require("@dieugene/utils");
            // Extend String prototype on first load
            I.updateStringPrototype();
            console.log('[MODULES] ✅ I.updateStringPrototype() called');
            return I;
        });
    },

    /**
     * Alias for utils()
     * @returns {Utils}
     */
    I() {
        return this.utils();
    },

    /**
     * Get logger singleton
     * @returns {Logger}
     */
    logger() {
        return _getOrCreate('logger', () => {
            if (!bot_domain) {
                throw new Error('[MODULES] BOT_NAME environment variable not set');
            }
            return require("@dieugene/logger")(bot_domain);
        });
    },

    /**
     * Get Telegraf bot singleton
     * @returns {TelegrafBot}
     */
    bot() {
        return _getOrCreate('bot', () => {
            const { Telegraf } = require('telegraf');
            if (!bot_token) {
                throw new Error('[MODULES] TELEGRAM_BOT_TOKEN environment variable not set');
            }
            return new Telegraf(bot_token, {
                handlerTimeout: Number.POSITIVE_INFINITY
            });
        });
    },

    /**
     * For testing: reset all instances
     * @private
     */
    _reset() {
        Object.keys(_instances).forEach(key => delete _instances[key]);
        console.log('[MODULES] Reset all instances');
    }
};

module.exports = modules;
```

### 3.3 Key Improvements in v2.0.0

#### ✅ IDE Autocomplete Support

```javascript
const modules = require('./src/core/modules');

// ✅ IDE knows the type and shows all methods
const users = modules.users();
users.get_user_data();     // ← Autocomplete works!
users.set_user_data();     // ← Autocomplete works!
users.tg.get_user_uuid();  // ← Autocomplete works!

const queuer = modules.queuer();
queuer.send_to_queue();    // ← Autocomplete works!
queuer.is_from_queue();    // ← Autocomplete works!
```

#### ✅ Automatic Initialization Inside Factory

```javascript
// OLD APPROACH (manual init)
const users = require("@dieugene/users-controller");
users.init(); // ❌ Can be called multiple times, forgotten, etc.

// NEW APPROACH (automatic init)
const users = modules.users(); // ✅ init() called automatically on first load
```

#### ✅ No Repeated Initialization

```javascript
// First call
const users1 = modules.users(); // → Calls factory → users.init() executed

// Subsequent calls
const users2 = modules.users(); // → Returns cached instance → init() NOT called again
const users3 = modules.users(); // → Returns cached instance → init() NOT called again

// users1 === users2 === users3 (same instance)
```

#### ✅ No Class Passing Through Loader

```javascript
// Classes imported directly (not through module manager)
const { Dialog } = require("@dialogai/dialog-class");
const { YdbChatMessageHistory } = require("@dialogai/ydb-chat-history");
const { ChatOpenAI } = require("@langchain/openai");

// These are factory classes, create new instance per usage
const dialog = new Dialog(...);
const history = new YdbChatMessageHistory(...);
const model = new ChatOpenAI(...);
```

---

## 4. Migration Plan

### Phase 1: Create Module Manager (Priority: CRITICAL)

**Files to create:**
- `src/core/modules.js` - Module Manager implementation

**Estimated time:** 1 hour

### Phase 2: Update Entry Point (Priority: CRITICAL)

**File: index.js**

```javascript
// BEFORE
const users = require("@dieugene/users-controller");
const I = require("@dieugene/utils");
const sessions = require('@dieugene/sessions');
const tg_cache = require("@dieugene/tg-messages-cache");
const queuer = require("@dieugene/queuer")();
const logger = require("@dieugene/logger")(bot_domain);

I.updateStringPrototype(); // ❌ Manual call
users.init();              // ❌ Manual call

// AFTER (v2.0.0)
const modules = require('./src/core/modules');

// Get singleton instances with individual loaders
const users = modules.users();       // ✅ Auto-calls users.init()
const I = modules.utils();           // ✅ Auto-calls I.updateStringPrototype()
const sessions = modules.sessions();
const tg_cache = modules.tg_cache();
const queuer = modules.queuer();
const logger = modules.logger();
const bot = modules.bot();

// ✅ IDE autocomplete works for all modules
// ✅ No manual init() calls needed
// ✅ Initialization guaranteed on first usage
```

**Estimated time:** 30 minutes

### Phase 3: Update Internal Modules (Priority: HIGH)

**Files to update:**
- `src/modules/timer-handler.js`
- `src/modules/dialog-system.js`
- `src/modules/workspace-manager.js`
- `src/modules/reports-bus.js`
- `src/modules/notification-router.js`
- `src/modules/dashboard-generator.js`
- `src/modules/summary-generator.js`
- `src/modules/ai-insights.js`

**Example: timer-handler.js**

```javascript
// BEFORE
const users = require("@dieugene/users-controller");
const queuer = require("@dieugene/queuer")();  // ❌ New instance
const I = require("@dieugene/utils");
const { Telegraf } = require('telegraf');

users.init(); // ❌ Duplicate init call

// AFTER (v2.0.0)
const modules = require('../core/modules');
const { Telegraf } = require('telegraf');

// Get singleton instances with individual loaders
const users = modules.users();     // ✅ Singleton, already initialized
const queuer = modules.queuer();   // ✅ Same instance as in index.js
const I = modules.I();              // ✅ Alias for utils()

// ✅ No init() calls needed
// ✅ IDE autocomplete works
// ✅ Same instances across all modules
```

**Example: dialog-system.js**

```javascript
// BEFORE
const { Dialog } = require("@dialogai/dialog-class");
const { YdbChatMessageHistory } = require("@dialogai/ydb-chat-history");
const { HumanMessage, AIMessage, SystemMessage } = require("@langchain/core/messages");
const { DynamicStructuredTool } = require("@langchain/core/tools");
const I = require("@dieugene/utils");
const users = require("@dieugene/users-controller");
const { z } = require('zod');

// AFTER (v2.0.0)
const modules = require('../core/modules');

// Singleton modules via loaders
const I = modules.I();
const users = modules.users();

// Factory classes imported directly (NOT through module manager)
const { Dialog } = require("@dialogai/dialog-class");
const { YdbChatMessageHistory } = require("@dialogai/ydb-chat-history");
const { HumanMessage, AIMessage, SystemMessage } = require("@langchain/core/messages");
const { DynamicStructuredTool } = require("@langchain/core/tools");
const { z } = require('zod');

// ✅ Singleton modules: via modules.xxx()
// ✅ Factory classes: direct import
// ✅ Stateless libraries: direct import
```

**Estimated time:** 2 hours (15 min per file × 8 files)

### Phase 4: Testing (Priority: CRITICAL)

**Test checklist:**

1. **Singleton verification:**
   ```javascript
   const modules = require('./src/core/modules');

   // Test 1: Same instance across multiple calls
   const queuer1 = modules.queuer();
   const queuer2 = modules.queuer();
   assert(queuer1 === queuer2); // ✅ Must be same instance

   // Test 2: Same instance across different modules
   const users1 = modules.users();
   const users2 = modules.users();
   assert(users1 === users2); // ✅ Must be same instance

   // Test 3: Singleton registry works
   const I1 = modules.I();
   const I2 = modules.utils();
   assert(I1 === I2); // ✅ Alias returns same instance
   ```

2. **Initialization called once:**
   ```javascript
   // Mock to count init calls
   let initCallCount = 0;
   jest.mock('@dieugene/users-controller', () => ({
       init: () => { initCallCount++; }
   }));

   const users1 = modules.users(); // First call → init()
   const users2 = modules.users(); // Second call → NO init()

   assert(initCallCount === 1); // ✅ init() called only once
   ```

3. **IDE type hints work:**
   - Open VS Code / WebStorm
   - Type `modules.users().` → IDE should show autocomplete with all methods
   - Type `modules.queuer().` → IDE should show autocomplete
   - Verify JSDoc type annotations work

3. **Integration tests:**
   - Test message processing through queue
   - Test session management
   - Test cache operations

**Estimated time:** 2 hours

---

## 5. Benefits (v2.0.0)

### 5.1 Guaranteed Singleton Pattern
- ✅ Only one instance of stateful modules
- ✅ Shared state across entire application
- ✅ No race conditions from multiple initializations

### 5.2 IDE Autocomplete & Type Safety (NEW in v2.0.0)
- ✅ **JSDoc type annotations** provide full IDE autocomplete
- ✅ Individual functions (`modules.users()`) instead of generic `get(name)`
- ✅ VS Code, WebStorm, and other IDEs show all available methods
- ✅ Type hints work without TypeScript
- ✅ Better developer experience and productivity

### 5.3 Automatic Initialization (NEW in v2.0.0)
- ✅ **Initialization inside factory functions** (no manual init() calls)
- ✅ `modules.users()` automatically calls `users.init()` on first load
- ✅ `modules.utils()` automatically calls `I.updateStringPrototype()`
- ✅ Impossible to forget initialization
- ✅ Guaranteed correct initialization order

### 5.4 Lazy Loading
- ✅ Modules loaded only when needed
- ✅ Faster startup time
- ✅ Reduced memory footprint
- ✅ On-demand initialization

### 5.5 Testability
- ✅ Easy to mock modules in tests via `_reset()`
- ✅ Clear module dependencies
- ✅ Isolated unit testing
- ✅ Count initialization calls in tests

### 5.6 Maintainability
- ✅ Single source of truth for module configuration
- ✅ Easy to add new modules (just add new function)
- ✅ Clear separation of concerns
- ✅ No class passing through loader (factory classes imported directly)

---

## 6. Alternative Approaches (Considered & Rejected)

### 6.1 Dependency Injection Container (e.g., InversifyJS)

**Pros:**
- Industry-standard pattern
- Strong TypeScript support
- Advanced features (decorators, middleware)

**Cons:**
- ❌ Heavy dependency (~100KB)
- ❌ Steep learning curve
- ❌ Overkill for this project size
- ❌ Requires significant refactoring

**Verdict:** Too complex for current needs

### 6.2 Global Singleton Registry

```javascript
// globals.js
global.queuer = require("@dieugene/queuer")();
global.sessions = require('@dieugene/sessions');
```

**Pros:**
- Simple to implement
- No import changes needed

**Cons:**
- ❌ Pollutes global namespace
- ❌ No IDE autocomplete
- ❌ Hard to track dependencies
- ❌ Anti-pattern in Node.js

**Verdict:** Bad practice, not recommended

### 6.3 Native Node.js require() Caching

**Reality check:** Node.js DOES cache `require()`, BUT:
- `require("@dieugene/queuer")()` - the `()` creates NEW instance each time
- `users.init()` - called multiple times without guard
- `I.updateStringPrototype()` - not guaranteed to run first

**Verdict:** Not sufficient without wrapper

---

## 7. Implementation Checklist

### Developer Tasks:

- [ ] Create `src/core/` directory
- [ ] Implement `src/core/modules.js` with full singleton registry
- [ ] Update `index.js` to use Module Manager
- [ ] Update all 8 internal modules in `src/modules/`
- [ ] Remove duplicate `users.init()` calls
- [ ] Remove duplicate `I.updateStringPrototype()` calls
- [ ] Remove `require("@dieugene/queuer")()` from all files except modules.js
- [ ] Add unit tests for Module Manager
- [ ] Add integration tests for singleton verification
- [ ] Update documentation

### Reviewer Tasks:

- [ ] Verify no direct `require()` for stateful modules outside modules.js
- [ ] Verify `modules.init()` called exactly once in index.js
- [ ] Verify all modules use `modules.get()` or `modules.getMany()`
- [ ] Verify no multiple initialization calls (users.init, etc.)
- [ ] Check test coverage for Module Manager

### Tester Tasks:

- [ ] Test message queue processing with multiple modules
- [ ] Test session management across modules
- [ ] Test cache consistency
- [ ] Load testing to verify single Telegraf instance
- [ ] Memory profiling to detect multiple instances

---

## 8. Risk Assessment

### High Risk:
- **Breaking changes:** All internal modules require refactoring
- **Testing complexity:** Need to verify singleton behavior across all use cases

### Medium Risk:
- **Migration time:** Estimated 5-6 hours total
- **Potential bugs:** Incorrect initialization order could cause failures

### Low Risk:
- **Performance impact:** Minimal (lazy loading actually improves performance)
- **Backward compatibility:** Internal change only, no API changes

---

## 9. Success Criteria

### Must Have:
1. ✅ Only ONE instance of queuer across entire application
2. ✅ Only ONE call to users.init()
3. ✅ Only ONE call to I.updateStringPrototype()
4. ✅ All tests pass

### Should Have:
1. ✅ All internal modules use Module Manager
2. ✅ No direct require() for stateful modules
3. ✅ Module Manager has unit tests

### Nice to Have:
1. ✅ Memory usage reduced by 10-15%
2. ✅ Startup time improved
3. ✅ Better error messages for initialization failures

---

## 10. Next Steps

1. **Architect:** Review and approve this specification
2. **Developer:** Implement Module Manager following this spec
3. **Reviewer:** Code review of implementation
4. **Tester:** Execute test plan
5. **Architect:** Final acceptance

---

**Status:** 📋 SPECIFICATION READY FOR REVIEW
**Estimated Implementation Time:** 5-6 hours
**Priority:** 🔴 CRITICAL

---

**Architect:** Claude
**Date:** 2025-11-12
