import { builtinModules } from 'module';
import { execSync } from 'child_process';
import { readFileSync } from 'fs';

import babel from '@rollup/plugin-babel';
import commonjs from '@rollup/plugin-commonjs';
import compiler from '@ampproject/rollup-plugin-closure-compiler';
import json from '@rollup/plugin-json';
import replace from '@rollup/plugin-replace';
import resolve from '@rollup/plugin-node-resolve';
import url from '@rollup/plugin-url';

import entryManifest from './plugins/entryManifest.mjs';

const pkg = JSON.parse(readFileSync('./package.json'));

const buildId = process.env.BUILD_ID || execSync('git rev-parse --short HEAD').toString().trim();

const manifest = entryManifest();

const client = ['browse', 'main'].map(entryName => {
  return {
    external: ['@emotion/react', 'react', 'react-dom'],
    input: `modules/client/${entryName}.js`,
    output: {
      format: 'iife',
      dir: 'public/_client',
      entryFileNames: '[name]-[hash].js',
      globals: {
        react: 'React',
        'react-dom': 'ReactDOM',
        '@emotion/react': 'emotionReact',
      },
    },
    moduleContext: {
      'node_modules/react-icons/lib/esm/iconBase.js': 'window',
    },
    plugins: [
      manifest.record({ publicPath: '/_client/' }),
      babel({ babelHelpers: 'bundled', exclude: /node_modules/ }),
      json(),
      resolve(),
      commonjs({
        namedExports: {
          'node_modules/react/index.js': ['createContext', 'createElement', 'forwardRef', 'Component', 'Fragment'],
        },
      }),
      replace({
        preventAssignment: true,
        values: {
          'process.env.BUILD_ID': JSON.stringify(buildId),
          'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
        },
      }),
      url({
        limit: 5 * 1024,
        publicPath: '/_client/',
      }),
      compiler(),
    ],
  };
});

const dependencies = (
  process.env.NODE_ENV === 'development'
    ? Object.keys(pkg.dependencies).concat(Object.keys(pkg.devDependencies || {}))
    : Object.keys(pkg.dependencies)
).concat('react-dom/server');

const server = {
  external: builtinModules.concat(dependencies).filter(d => !['mime'].includes(d)),
  input: 'modules/server.js',
  output: { file: 'server.js', format: 'cjs' },
  moduleContext: {
    'node_modules/react-icons/lib/esm/iconBase.js': 'global',
  },
  plugins: [
    manifest.inject({ virtualId: 'entry-manifest' }),
    babel({ babelHelpers: 'bundled', exclude: /node_modules/ }),
    json(),
    resolve(),
    commonjs(),
    url({
      limit: 5 * 1024,
      publicPath: '/_client/',
      emitFiles: false,
    }),
    replace({
      preventAssignment: true,
      values: {
        'process.env.BUILD_ID': JSON.stringify(buildId),
      },
    }),
  ],
};

export default client.concat(server);
