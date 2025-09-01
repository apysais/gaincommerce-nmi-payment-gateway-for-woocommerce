const defaultConfig = require('@wordpress/scripts/config/webpack.config');
const path = require('path');

module.exports = {
    ...defaultConfig,
    entry: {
        'checkout-blocks': './src/blocks/checkout-blocks.js',
    },
    output: {
        ...defaultConfig.output,
        path: path.resolve(process.cwd(), 'assets/js/build'),
        filename: '[name].js',
    },
    externals: {
        ...defaultConfig.externals,
        '@woocommerce/blocks-registry': ['wc', 'wcBlocksRegistry'],
        '@woocommerce/settings': ['wc', 'wcSettings'],
    },
};
