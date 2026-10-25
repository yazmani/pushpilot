import { startBackground } from '@/background';

export default defineBackground({
  type: 'module',
  main: startBackground,
});
