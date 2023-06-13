import { plugin } from "bun";
import transform from './src/transform';

plugin({
  name: "simulabra",
  setup(build) {
    build.onLoad({ filter: /\.jsx$/ }, (args) => {
      return {
        contents: transform(args.path),
        loader: 'js',
      };
    });
  },
});
