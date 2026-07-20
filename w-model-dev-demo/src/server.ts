import app from './app.js';
import { PORT } from './utils/env.js';

app.listen(PORT, () => {
  console.log(`Blog API listening on :${PORT}`);
});
