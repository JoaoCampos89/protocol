import { ChainId, getContractAddressesForChainOrThrow } from '@0x/contract-addresses';
import { FillQuoteTransformerOrderType } from '@0x/protocol-utils';
import { BigNumber } from '@0x/utils';
import { formatBytes32String } from '@ethersproject/strings';

import {
    ERC20BridgeSource,
    FillData,
} from '../../sources/types';
import { UNISWAP_V3_GAS_SCHEDULE, UNISWAP_V2_GAS_SCHEDULE, KYBER_GAS_SCHEDULE } from '../../sources/dexes';

import { TokenAdjacencyGraphBuilder } from '../token_adjacency_graph_builder';
import { valueByChainId } from '../utils';

import { SourceFilters } from './source_filters';
import {
    BancorFillData,
    CurveFillData,
    CurveFunctionSelectors,
    CurveInfo,
    DODOFillData,
    FeeSchedule,
    GetMarketOrdersOpts,
    KyberSamplerOpts,
    LiquidityProviderFillData,
    LiquidityProviderRegistry,
    MakerPsmFillData,
    MultiHopFillData,
    PsmInfo,
    TokenAdjacencyGraph,
    UniswapV2FillData,
} from './types';

// tslint:disable: custom-no-magic-numbers no-bitwise

export const ERC20_PROXY_ID = '0xf47261b0';
export const WALLET_SIGNATURE = '0x04';
export const ONE_ETHER = new BigNumber(1e18);
export const NEGATIVE_INF = new BigNumber('-Infinity');
export const POSITIVE_INF = new BigNumber('Infinity');
export const ZERO_AMOUNT = new BigNumber(0);
export const MAX_UINT256 = new BigNumber(2).pow(256).minus(1);
export const ONE_HOUR_IN_SECONDS = 60 * 60;
export const ONE_SECOND_MS = 1000;
export const NULL_BYTES = '0x';
export const NULL_ADDRESS = '0x0000000000000000000000000000000000000000';
export const COMPARISON_PRICE_DECIMALS = 10;

// TODO(kimpers): Consolidate this implementation with the one in @0x/token-metadata
function valueByChainId<T>(rest: Partial<{ [key in ChainId]: T }>, defaultValue: T): { [key in ChainId]: T } {
    // TODO I don't like this but iterating through enums is weird
    return {
        [ChainId.Mainnet]: defaultValue,
        [ChainId.Ropsten]: defaultValue,
        [ChainId.Rinkeby]: defaultValue,
        [ChainId.Kovan]: defaultValue,
        [ChainId.Ganache]: defaultValue,
        [ChainId.BSC]: defaultValue,
        [ChainId.Polygon]: defaultValue,
        [ChainId.PolygonMumbai]: defaultValue,
        ...(rest || {}),
    };
}

/**
 * Valid sources for market sell.
 */
export const SELL_SOURCE_FILTER_BY_CHAIN_ID = valueByChainId<SourceFilters>(
    {
        [ChainId.Mainnet]: new SourceFilters([
            ERC20BridgeSource.Native,
            ERC20BridgeSource.Uniswap,
            ERC20BridgeSource.UniswapV2,
            ERC20BridgeSource.Eth2Dai,
            ERC20BridgeSource.Kyber,
            ERC20BridgeSource.Curve,
            ERC20BridgeSource.Balancer,
            ERC20BridgeSource.BalancerV2,
            ERC20BridgeSource.Bancor,
            ERC20BridgeSource.MStable,
            ERC20BridgeSource.Mooniswap,
            ERC20BridgeSource.Swerve,
            ERC20BridgeSource.SnowSwap,
            ERC20BridgeSource.SushiSwap,
            ERC20BridgeSource.Shell,
            ERC20BridgeSource.MultiHop,
            ERC20BridgeSource.Dodo,
            ERC20BridgeSource.DodoV2,
            ERC20BridgeSource.Cream,
            ERC20BridgeSource.LiquidityProvider,
            ERC20BridgeSource.CryptoCom,
            ERC20BridgeSource.Linkswap,
            ERC20BridgeSource.MakerPsm,
            ERC20BridgeSource.KyberDmm,
            ERC20BridgeSource.Smoothy,
            ERC20BridgeSource.Component,
            ERC20BridgeSource.Saddle,
            ERC20BridgeSource.XSigma,
            ERC20BridgeSource.UniswapV3,
        ]),
        [ChainId.Ropsten]: new SourceFilters([
            ERC20BridgeSource.Kyber,
            ERC20BridgeSource.Native,
            ERC20BridgeSource.SushiSwap,
            ERC20BridgeSource.Uniswap,
            ERC20BridgeSource.UniswapV2,
            ERC20BridgeSource.UniswapV3,
            ERC20BridgeSource.Curve,
            ERC20BridgeSource.Mooniswap,
        ]),
        [ChainId.Rinkeby]: new SourceFilters([ERC20BridgeSource.Native]),
        [ChainId.Kovan]: new SourceFilters([ERC20BridgeSource.Native]),
        [ChainId.Ganache]: new SourceFilters([ERC20BridgeSource.Native]),
        [ChainId.BSC]: new SourceFilters([
            ERC20BridgeSource.BakerySwap,
            ERC20BridgeSource.Belt,
            ERC20BridgeSource.Dodo,
            ERC20BridgeSource.DodoV2,
            ERC20BridgeSource.Ellipsis,
            ERC20BridgeSource.Mooniswap,
            ERC20BridgeSource.MultiHop,
            ERC20BridgeSource.Nerve,
            ERC20BridgeSource.PancakeSwap,
            ERC20BridgeSource.PancakeSwapV2,
            ERC20BridgeSource.SushiSwap,
            ERC20BridgeSource.Smoothy,
            ERC20BridgeSource.ApeSwap,
            ERC20BridgeSource.CafeSwap,
            ERC20BridgeSource.CheeseSwap,
            ERC20BridgeSource.JulSwap,
            ERC20BridgeSource.LiquidityProvider,
        ]),
        [ChainId.Polygon]: new SourceFilters([
            ERC20BridgeSource.SushiSwap,
            ERC20BridgeSource.QuickSwap,
            ERC20BridgeSource.ComethSwap,
            ERC20BridgeSource.Dfyn,
            ERC20BridgeSource.MStable,
            ERC20BridgeSource.Curve,
            ERC20BridgeSource.DodoV2,
            ERC20BridgeSource.Dodo,
        ]),
    },
    new SourceFilters([]),
);

/**
 * Valid sources for market buy.
 */
export const BUY_SOURCE_FILTER_BY_CHAIN_ID = valueByChainId<SourceFilters>(
    {
        [ChainId.Mainnet]: new SourceFilters([
            ERC20BridgeSource.Native,
            ERC20BridgeSource.Uniswap,
            ERC20BridgeSource.UniswapV2,
            ERC20BridgeSource.Eth2Dai,
            ERC20BridgeSource.Kyber,
            ERC20BridgeSource.Curve,
            ERC20BridgeSource.Balancer,
            ERC20BridgeSource.BalancerV2,
            // ERC20BridgeSource.Bancor, // FIXME: Bancor Buys not implemented in Sampler
            ERC20BridgeSource.MStable,
            ERC20BridgeSource.Mooniswap,
            ERC20BridgeSource.Shell,
            ERC20BridgeSource.Swerve,
            ERC20BridgeSource.SnowSwap,
            ERC20BridgeSource.SushiSwap,
            ERC20BridgeSource.MultiHop,
            ERC20BridgeSource.Dodo,
            ERC20BridgeSource.DodoV2,
            ERC20BridgeSource.Cream,
            ERC20BridgeSource.LiquidityProvider,
            ERC20BridgeSource.CryptoCom,
            ERC20BridgeSource.Linkswap,
            ERC20BridgeSource.MakerPsm,
            ERC20BridgeSource.KyberDmm,
            ERC20BridgeSource.Smoothy,
            ERC20BridgeSource.Component,
            ERC20BridgeSource.Saddle,
            ERC20BridgeSource.XSigma,
            ERC20BridgeSource.UniswapV3,
        ]),
        [ChainId.Ropsten]: new SourceFilters([
            ERC20BridgeSource.Kyber,
            ERC20BridgeSource.Native,
            ERC20BridgeSource.SushiSwap,
            ERC20BridgeSource.Uniswap,
            ERC20BridgeSource.UniswapV2,
            ERC20BridgeSource.UniswapV3,
            ERC20BridgeSource.Curve,
            ERC20BridgeSource.Mooniswap,
        ]),
        [ChainId.Rinkeby]: new SourceFilters([ERC20BridgeSource.Native]),
        [ChainId.Kovan]: new SourceFilters([ERC20BridgeSource.Native]),
        [ChainId.Ganache]: new SourceFilters([ERC20BridgeSource.Native]),
        [ChainId.BSC]: new SourceFilters([
            ERC20BridgeSource.BakerySwap,
            ERC20BridgeSource.Belt,
            ERC20BridgeSource.Dodo,
            ERC20BridgeSource.DodoV2,
            ERC20BridgeSource.Ellipsis,
            ERC20BridgeSource.Mooniswap,
            ERC20BridgeSource.MultiHop,
            ERC20BridgeSource.Nerve,
            ERC20BridgeSource.PancakeSwap,
            ERC20BridgeSource.PancakeSwapV2,
            ERC20BridgeSource.SushiSwap,
            ERC20BridgeSource.Smoothy,
            ERC20BridgeSource.ApeSwap,
            ERC20BridgeSource.CafeSwap,
            ERC20BridgeSource.CheeseSwap,
            ERC20BridgeSource.JulSwap,
            ERC20BridgeSource.LiquidityProvider,
        ]),
        [ChainId.Polygon]: new SourceFilters([
            ERC20BridgeSource.SushiSwap,
            ERC20BridgeSource.QuickSwap,
            ERC20BridgeSource.ComethSwap,
            ERC20BridgeSource.Dfyn,
            ERC20BridgeSource.MStable,
            ERC20BridgeSource.Curve,
            ERC20BridgeSource.DodoV2,
            ERC20BridgeSource.Dodo,
        ]),
    },
    new SourceFilters([]),
);

/**
 *  0x Protocol Fee Multiplier
 */
export const PROTOCOL_FEE_MULTIPLIER = new BigNumber(70000);

/**
 * Sources to poll for ETH fee price estimates.
 */
export const FEE_QUOTE_SOURCES_BY_CHAIN_ID = valueByChainId<ERC20BridgeSource[]>(
    {
        [ChainId.Mainnet]: [ERC20BridgeSource.UniswapV2, ERC20BridgeSource.SushiSwap],
        [ChainId.BSC]: [ERC20BridgeSource.PancakeSwap, ERC20BridgeSource.Mooniswap, ERC20BridgeSource.SushiSwap],
        [ChainId.Ropsten]: [ERC20BridgeSource.UniswapV2, ERC20BridgeSource.SushiSwap],
        [ChainId.Polygon]: [ERC20BridgeSource.QuickSwap, ERC20BridgeSource.SushiSwap],
    },
    [],
);

// HACK(mzhu25): Limit and RFQ orders need to be treated as different sources
//               when computing the exchange proxy gas overhead.
export const SOURCE_FLAGS: { [key in ERC20BridgeSource]: number } & {
    RfqOrder: number;
    LimitOrder: number;
} = Object.assign(
    {},
    ...['RfqOrder', 'LimitOrder', ...Object.values(ERC20BridgeSource)].map((source, index) => ({
        [source]: source === ERC20BridgeSource.Native ? 0 : 1 << index,
    })),
);

export const DEFAULT_INTERMEDIATE_TOKENS_BY_CHAIN_ID = valueByChainId<string[]>(
    {
        [ChainId.Mainnet]: [
            MAINNET_TOKENS.WETH,
            MAINNET_TOKENS.USDT,
            MAINNET_TOKENS.DAI,
            MAINNET_TOKENS.USDC,
            MAINNET_TOKENS.WBTC,
        ],
        [ChainId.BSC]: [
            '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c', // WBNB
            '0xe9e7cea3dedca5984780bafc599bd69add087d56', // BUSD
            '0x1af3f329e8be154074d8769d1ffa4ee058b1dbc3', // DAI
            '0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d', // USDC
            '0x2170ed0880ac9a755fd29b2688956bd959f933f8', // ETH
            '0x55d398326f99059ff775485246999027b3197955', // BUSD-T
        ],
        [ChainId.Ropsten]: [
            getContractAddressesForChainOrThrow(ChainId.Ropsten).etherToken,
            '0xad6d458402f60fd3bd25163575031acdce07538d', // DAI
            '0x07865c6e87b9f70255377e024ace6630c1eaa37f', // USDC
        ],
        [ChainId.Polygon]: [
            POLYGON_TOKENS.WMATIC,
            POLYGON_TOKENS.WETH,
            POLYGON_TOKENS.USDC,
            POLYGON_TOKENS.DAI,
            POLYGON_TOKENS.USDT,
            POLYGON_TOKENS.WBTC,
        ],
    },
    [],
);

export const DEFAULT_TOKEN_ADJACENCY_GRAPH_BY_CHAIN_ID = valueByChainId<TokenAdjacencyGraph>(
    {
        [ChainId.Mainnet]: new TokenAdjacencyGraphBuilder({
            default: DEFAULT_INTERMEDIATE_TOKENS_BY_CHAIN_ID[ChainId.Mainnet],
        })
            // Mirror Protocol
            .tap(builder => {
                builder
                    .add(MAINNET_TOKENS.MIR, MAINNET_TOKENS.UST)
                    .add(MAINNET_TOKENS.UST, [MAINNET_TOKENS.MIR, ...Object.values(MIRROR_WRAPPED_TOKENS)])
                    .add(MAINNET_TOKENS.USDT, MAINNET_TOKENS.UST);
                Object.values(MIRROR_WRAPPED_TOKENS).forEach(t => builder.add(t, MAINNET_TOKENS.UST));
            })
            // Build
            .build(),
        [ChainId.BSC]: new TokenAdjacencyGraphBuilder({
            default: DEFAULT_INTERMEDIATE_TOKENS_BY_CHAIN_ID[ChainId.BSC],
        }).build(),
        [ChainId.Polygon]: new TokenAdjacencyGraphBuilder({
            default: DEFAULT_INTERMEDIATE_TOKENS_BY_CHAIN_ID[ChainId.Polygon],
        }).build(),
    },
    new TokenAdjacencyGraphBuilder({ default: [] }).build(),
);

export const NATIVE_FEE_TOKEN_BY_CHAIN_ID = valueByChainId<string>(
    {
        [ChainId.Mainnet]: getContractAddressesForChainOrThrow(ChainId.Mainnet).etherToken,
        [ChainId.BSC]: getContractAddressesForChainOrThrow(ChainId.BSC).etherToken,
        [ChainId.Ganache]: getContractAddressesForChainOrThrow(ChainId.Ganache).etherToken,
        [ChainId.Ropsten]: getContractAddressesForChainOrThrow(ChainId.Ropsten).etherToken,
        [ChainId.Rinkeby]: getContractAddressesForChainOrThrow(ChainId.Rinkeby).etherToken,
        [ChainId.Kovan]: getContractAddressesForChainOrThrow(ChainId.Kovan).etherToken,
        [ChainId.Polygon]: getContractAddressesForChainOrThrow(ChainId.Polygon).etherToken,
    },
    NULL_ADDRESS,
);

export const NATIVE_FEE_TOKEN_AMOUNT_BY_CHAIN_ID = valueByChainId(
    { [ChainId.Mainnet]: ONE_ETHER.times(0.1) },
    ONE_ETHER,
);

/**
 * Mainnet Curve configuration
 * The tokens are in order of their index, which each curve defines
 * I.e DaiUsdc curve has DAI as index 0 and USDC as index 1
 */

/**
 * Kyber reserve prefixes
 * 0xff Fed price reserve
 * 0xaa Automated price reserve
 * 0xbb Bridged price reserve (i.e Uniswap/Curve)
 */



export const MAKER_PSM_INFO_BY_CHAIN_ID = valueByChainId<PsmInfo>(
    {
        [ChainId.Mainnet]: {
            // Currently only USDC is supported
            gemTokenAddress: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
            ilkIdentifier: formatBytes32String('PSM-USDC-A'),
            psmAddress: '0x89b78cfa322f6c5de0abceecab66aee45393cc5a',
        },
    },
    {
        gemTokenAddress: NULL_ADDRESS,
        ilkIdentifier: NULL_BYTES,
        psmAddress: NULL_ADDRESS,
    },
);

export const MOONISWAP_LIQUIDITY_PROVIDER_BY_CHAIN_ID = valueByChainId<string>(
    {
        [ChainId.Mainnet]: '0xa2033d6ba88756ce6a87584d69dc87bda9a4f889',
        [ChainId.Ropsten]: '0x87e0393aee0fb8c10b8653c6507c182264fe5a34',
    },
    NULL_ADDRESS,
);

export const BANCOR_REGISTRY_BY_CHAIN_ID = valueByChainId<string>(
    {
        [ChainId.Mainnet]: '0x52Ae12ABe5D8BD778BD5397F99cA900624CfADD4',
    },
    NULL_ADDRESS,
);

//
// BSC
//

//
// Polygon
//

const uniswapV2CloneGasSchedule = (fillData?: FillData) => {
    // TODO: Different base cost if to/from ETH.
    let gas = 90e3;
    const path = (fillData as UniswapV2FillData).tokenAddressPath;
    if (path.length > 2) {
        gas += (path.length - 2) * 60e3; // +60k for each hop.
    }
    return gas;
};

/**
 * Calculated gross gas cost of the underlying exchange.
 * The cost of switching from one source to another, assuming
 * we are in the middle of a transaction.
 * I.e remove the overhead cost of ExchangeProxy (130k) and
 * the ethereum transaction cost (21k)
 */
// tslint:disable:custom-no-magic-numbers
export const DEFAULT_GAS_SCHEDULE: Required<FeeSchedule> = {
    [ERC20BridgeSource.Native]: fillData => {
        // TODO jacob re-order imports so there is no circular rependency with SignedNativeOrder
        const nativeFillData = fillData as { type: FillQuoteTransformerOrderType };
        return nativeFillData && nativeFillData.type === FillQuoteTransformerOrderType.Limit
            ? PROTOCOL_FEE_MULTIPLIER.plus(100e3).toNumber()
            : // TODO jacob revisit wth v4 LimitOrders
              100e3;
    },
    [ERC20BridgeSource.Uniswap]: () => 90e3,
    [ERC20BridgeSource.LiquidityProvider]: fillData => {
        return (fillData as LiquidityProviderFillData).gasCost || 100e3;
    },
    [ERC20BridgeSource.Eth2Dai]: () => 400e3,
    [ERC20BridgeSource.Kyber]: KYBER_GAS_SCHEDULE,
    [ERC20BridgeSource.Curve]: fillData => (fillData as CurveFillData).pool.gasSchedule,
    [ERC20BridgeSource.Swerve]: fillData => (fillData as CurveFillData).pool.gasSchedule,
    [ERC20BridgeSource.SnowSwap]: fillData => (fillData as CurveFillData).pool.gasSchedule,
    [ERC20BridgeSource.Nerve]: fillData => (fillData as CurveFillData).pool.gasSchedule,
    [ERC20BridgeSource.Belt]: fillData => (fillData as CurveFillData).pool.gasSchedule,
    [ERC20BridgeSource.Ellipsis]: fillData => (fillData as CurveFillData).pool.gasSchedule,
    [ERC20BridgeSource.Smoothy]: fillData => (fillData as CurveFillData).pool.gasSchedule,
    [ERC20BridgeSource.Saddle]: fillData => (fillData as CurveFillData).pool.gasSchedule,
    [ERC20BridgeSource.XSigma]: fillData => (fillData as CurveFillData).pool.gasSchedule,
    [ERC20BridgeSource.MultiBridge]: () => 350e3,
    [ERC20BridgeSource.UniswapV2]: uniswapV2CloneGasSchedule,
    [ERC20BridgeSource.SushiSwap]: uniswapV2CloneGasSchedule,
    [ERC20BridgeSource.CryptoCom]: uniswapV2CloneGasSchedule,
    [ERC20BridgeSource.Linkswap]: uniswapV2CloneGasSchedule,
    [ERC20BridgeSource.Balancer]: () => 120e3,
    [ERC20BridgeSource.BalancerV2]: () => 100e3,
    [ERC20BridgeSource.Cream]: () => 120e3,
    [ERC20BridgeSource.MStable]: () => 200e3,
    [ERC20BridgeSource.MakerPsm]: (fillData?: FillData) => {
        const psmFillData = fillData as MakerPsmFillData;
        return psmFillData.takerToken === psmFillData.gemTokenAddress ? 210e3 : 290e3;
    },
    [ERC20BridgeSource.Mooniswap]: () => 130e3,
    [ERC20BridgeSource.Shell]: () => 170e3,
    [ERC20BridgeSource.Component]: () => 188e3,
    [ERC20BridgeSource.MultiHop]: (fillData?: FillData) => {
        const firstHop = (fillData as MultiHopFillData).firstHopSource;
        const secondHop = (fillData as MultiHopFillData).secondHopSource;
        const firstHopGas = DEFAULT_GAS_SCHEDULE[firstHop.source](firstHop.fillData);
        const secondHopGas = DEFAULT_GAS_SCHEDULE[secondHop.source](secondHop.fillData);
        return new BigNumber(firstHopGas)
            .plus(secondHopGas)
            .plus(30e3)
            .toNumber();
    },
    [ERC20BridgeSource.Dodo]: (fillData?: FillData) => {
        const isSellBase = (fillData as DODOFillData).isSellBase;
        // Sell base is cheaper as it is natively supported
        // sell quote requires additional calculation and overhead
        return isSellBase ? 180e3 : 300e3;
    },
    [ERC20BridgeSource.DodoV2]: (_fillData?: FillData) => 100e3,
    [ERC20BridgeSource.Bancor]: (fillData?: FillData) => {
        let gas = 200e3;
        const path = (fillData as BancorFillData).path;
        if (path.length > 2) {
            gas += (path.length - 2) * 60e3; // +60k for each hop.
        }
        return gas;
    },
    [ERC20BridgeSource.KyberDmm]: (fillData?: FillData) => {
        // TODO: Different base cost if to/from ETH.
        let gas = 95e3;
        const path = (fillData as UniswapV2FillData).tokenAddressPath;
        if (path.length > 2) {
            gas += (path.length - 2) * 65e3; // +65k for each hop.
        }
        return gas;
    },
    [ERC20BridgeSource.UniswapV3]: (fillData?: FillData) => {
        let gas = 160e3;
        const path = (fillData as UniswapV3FillData).tokenAddressPath;
        if (path.length > 2) {
            gas += (path.length - 2) * 117e3; // +117k for each hop.
        }
        return gas;
    },

    //
    // BSC
    //
    [ERC20BridgeSource.PancakeSwap]: uniswapV2CloneGasSchedule,
    [ERC20BridgeSource.PancakeSwapV2]: uniswapV2CloneGasSchedule,
    [ERC20BridgeSource.BakerySwap]: uniswapV2CloneGasSchedule,
    [ERC20BridgeSource.ApeSwap]: uniswapV2CloneGasSchedule,
    [ERC20BridgeSource.CafeSwap]: uniswapV2CloneGasSchedule,
    [ERC20BridgeSource.CheeseSwap]: uniswapV2CloneGasSchedule,
    [ERC20BridgeSource.JulSwap]: uniswapV2CloneGasSchedule,

    //
    // Polygon
    //
    [ERC20BridgeSource.QuickSwap]: uniswapV2CloneGasSchedule,
    [ERC20BridgeSource.ComethSwap]: uniswapV2CloneGasSchedule,
    [ERC20BridgeSource.Dfyn]: uniswapV2CloneGasSchedule,
};

export const DEFAULT_FEE_SCHEDULE: Required<FeeSchedule> = { ...DEFAULT_GAS_SCHEDULE };

export const POSITIVE_SLIPPAGE_FEE_TRANSFORMER_GAS = new BigNumber(20000);

// tslint:enable:custom-no-magic-numbers

export const DEFAULT_GET_MARKET_ORDERS_OPTS: GetMarketOrdersOpts = {
    // tslint:disable-next-line: custom-no-magic-numbers
    runLimit: 2 ** 15,
    excludedSources: [],
    excludedFeeSources: [],
    includedSources: [],
    bridgeSlippage: 0.005,
    maxFallbackSlippage: 0.05,
    numSamples: 13,
    sampleDistributionBase: 1.05,
    feeSchedule: DEFAULT_FEE_SCHEDULE,
    gasSchedule: DEFAULT_GAS_SCHEDULE,
    exchangeProxyOverhead: () => ZERO_AMOUNT,
    allowFallback: true,
    shouldGenerateQuoteReport: true,
    shouldIncludePriceComparisonsReport: false,
    tokenAdjacencyGraph: { default: [] },
};
