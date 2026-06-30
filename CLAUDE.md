# Memory: WIARE Leads OS

## Commands

- **Build Project**: `npm run build`
- **Run Development Server**: `npm run dev`
- **Deploy to Production (Vercel)**: `npx vercel --prod --yes`
- **Run Linter**: `npm run lint`
- **Preview Production Build**: `npm run preview`
- **Verification Scripts**:
  - Run verification test: `node scripts/test-mhimbre.js` (Note: Run test scripts from the workspace root so Node can resolve local `node_modules` like `@supabase/supabase-js`).

## Technology Stack

- **Frontend**: React 19 (Vite), Tailwind CSS v3.4.17
- **Backend & Database**: Supabase JS Client (interacting with database tables like `leads_os`, `extracciones_os`, `token_usage_os`)
- **Hosting / Serverless**: Vercel Serverless Functions (directory `/api`, e.g. `/api/find-email.ts`)
- **AI Engine**: Google Gemini API via `src/lib/geminiApi.ts`

## Gemini Integration Guidelines

To keep Gemini calls fast, robust, and free of parsing crashes, follow these core principles:

1. **Structured Outputs**:
   - Always enforce native JSON schemas using `responseMimeType: 'application/json'` and `responseSchema` inside the `generationConfig` options.
   - Avoid requesting markdown formatting or wrappers (like ` ```json `) in the prompt itself.

2. **Disable Thinking/Reasoning**:
   - For fast responses and token budget safety (especially to prevent truncation under tight token limits), always set `thinkingConfig: { thinkingBudget: 0 }` inside the generation config.

3. **Prompt Simplification**:
   - **Do not include manual JSON templates or structural examples in the prompt text** when a `responseSchema` is active. Doing so can cause the model to get stuck in infinite spacing/tabulation indentation loops, triggering `MAX_TOKENS` truncation errors. Let the schema handle the formatting.

4. **Resilient Parsing**:
   - Always wrap the output parsing block in a `try/catch` and log the raw string response to assist in debugging.
