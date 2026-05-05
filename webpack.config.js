const defaultConfig = require('@wordpress/scripts/config/webpack.config');
const path = require('path');

module.exports = {
    ...defaultConfig,
    entry: {
        'checkout-blocks':   './src/blocks/checkout-blocks.js',
        'apple-pay-blocks':  './src/blocks/apple-pay-blocks.js',
        'google-pay-blocks': './src/blocks/google-pay-blocks.js',
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
