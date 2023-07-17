import { plugin } from "bun";
import transform from './src/transform';

plugin({
  name: "simulabra",
  setup(build) {
    build.onLoad({ filter: /\.jsx$/ }, (args) => {
      const contents = transform(args.path);
      return {
        contents,
        loader: 'js',
      };
    });
  },
});
