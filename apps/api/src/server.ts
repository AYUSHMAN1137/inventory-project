import { app } from './app.js';

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`[DeepTech Inventory API] Server listening on http://localhost:${PORT}`);
});
