import { z } from 'zod';
import th from 'zod/v4/locales/th.js';

// Built-in Thai validation messages for every schema used in the app (shared ones included).
// Imported directly: going through z.locales would bundle every language.
z.config(th());
