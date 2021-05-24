import { ChainId } from '@0x/contract-addresses';
import { BigNumber } from '@0x/utils';

import { Address } from '../../types';
import { Chain } from '../../utils/chain';
import { valueByChainId } from '../../utils/utils';
import { ERC20BridgeSamplerContract } from '../../wrappers';

import { NULL_ADDRESS } from '../constants';
import { SourceSamplerBase } from '../source_sampler';
import { MAINNET_TOKENS, POLYGON_TOKENS } from '../tokens';
import { DexSample, ERC20BridgeSource, FillData } from "../types";

export interface ShellFillData extends FillData {
    poolAddress: string;
}

interface ShellPoolInfo {
    poolAddress: Address;
    tokens: Address[];
}

interface ShellPoolInfosByName {
    [k: string]: ShellPoolInfo;
}

type ShellPoolsByChainId = {
    [k in ChainId]: ShellPoolInfosByName;
};

const SHELL_POOLS_BY_CHAIN_ID = valueByChainId(
    {
        [ChainId.Mainnet]: {
            StableCoins: {
                poolAddress: '0x8f26d7bab7a73309141a291525c965ecdea7bf42',
                tokens: [MAINNET_TOKENS.USDC, MAINNET_TOKENS.USDT, MAINNET_TOKENS.sUSD, MAINNET_TOKENS.DAI],
            },
            Bitcoin: {
                poolAddress: '0xc2d019b901f8d4fdb2b9a65b5d226ad88c66ee8d',
                tokens: [MAINNET_TOKENS.RenBTC, MAINNET_TOKENS.WBTC, MAINNET_TOKENS.sBTC],
            },
        },
    },
    {
        StableCoins: {
            poolAddress: NULL_ADDRESS,
            tokens: [] as string[],
        },
        Bitcoin: {
            poolAddress: NULL_ADDRESS,
            tokens: [] as string[],
        },
    },
) as ShellPoolsByChainId;

const COMPONENT_POOLS_BY_CHAIN_ID = valueByChainId(
    {
        [ChainId.Mainnet]: {
            USDP_USDC_USDT: {
                poolAddress: '0x49519631b404e06ca79c9c7b0dc91648d86f08db',
                tokens: [MAINNET_TOKENS.USDP, MAINNET_TOKENS.USDC, MAINNET_TOKENS.USDT],
            },
            USDP_DAI_SUSD: {
                poolAddress: '0x6477960dd932d29518d7e8087d5ea3d11e606068',
                tokens: [MAINNET_TOKENS.USDP, MAINNET_TOKENS.DAI, MAINNET_TOKENS.sUSD],
            },
        },
    },
    {
        USDP_USDC_USDT: {
            poolAddress: NULL_ADDRESS,
            tokens: [] as string[],
        },
        USDP_DAI_SUSD: {
            poolAddress: NULL_ADDRESS,
            tokens: [] as string[],
        },
    },
) as ShellPoolsByChainId;

const MSTABLE_POOLS_BY_CHAIN_ID = valueByChainId(
    {
        [ChainId.Mainnet]: {
            mUSD: {
                poolAddress: '0xe2f2a5c287993345a840db3b0845fbc70f5935a5',
                tokens: [MAINNET_TOKENS.DAI, MAINNET_TOKENS.USDC, MAINNET_TOKENS.USDT],
            },
            mBTC: {
                poolAddress: '0x945facb997494cc2570096c74b5f66a3507330a1',
                tokens: [MAINNET_TOKENS.WBTC, MAINNET_TOKENS.RenBTC, MAINNET_TOKENS.sBTC],
            },
        },
        [ChainId.Polygon]: {
            mUSD: {
                poolAddress: '0xe840b73e5287865eec17d250bfb1536704b43b21',
                tokens: [POLYGON_TOKENS.DAI, POLYGON_TOKENS.USDC, POLYGON_TOKENS.USDT],
            },
            mBTC: {
                poolAddress: NULL_ADDRESS,
                tokens: [] as string[],
            },
        },
    },
    {
        mUSD: {
            poolAddress: NULL_ADDRESS,
            tokens: [] as string[],
        },
        mBTC: {
            poolAddress: NULL_ADDRESS,
            tokens: [] as string[],
        },
    },
);

export class ShellSampler extends
    SourceSamplerBase<ERC20BridgeSamplerContract, ERC20BridgeSamplerContract>
{
    public static async createAsync(
        chain: Chain,
        fork: ERC20BridgeSource,
    ): Promise<ShellSampler> {
        let pools: ShellPoolInfo[];
        switch (fork) {
            case ERC20BridgeSource.Shell:
                pools = Object.values(SHELL_POOLS_BY_CHAIN_ID[chain.chainId]);
                break;
            case ERC20BridgeSource.Component:
                pools = Object.values(COMPONENT_POOLS_BY_CHAIN_ID[chain.chainId]);
                break;
            case ERC20BridgeSource.MStable:
                pools = Object.values(MSTABLE_POOLS_BY_CHAIN_ID[chain.chainId]);
                break;
            default:
                throw new Error(`Invalid Shell fork: ${fork}`);
        }
        return new ShellSampler(chain, fork, pools);
    }

    protected constructor(
        chain: Chain,
        public readonly fork: ERC20BridgeSource,
        private readonly _pools: ShellPoolInfo[],
    ) {
        super({
            chain,
            sellSamplerContractArtifactName: 'ERC20BridgeSampler',
            buySamplerContractArtifactName: 'ERC20BridgeSampler',
            sellSamplerContractType: ERC20BridgeSamplerContract,
            buySamplerContractType: ERC20BridgeSamplerContract,
        });
    }

    public canConvertTokens(tokenAddressPath: Address[], pools?: Address[]): boolean {
        if (tokenAddressPath.length != 2) {
            return false;
        }
        const _pools = pools || this._getPoolsForTokens(tokenAddressPath);
        if (_pools.length === 0) {
            return false;
        }
        return true;
    }

    public async getSellQuotesAsync(
        tokenAddressPath: Address[],
        takerFillAmounts: BigNumber[],
    ): Promise<DexSample<ShellFillData>[][]> {
        const pools = this._getPoolsForTokens(tokenAddressPath);
        if (!this.canConvertTokens(tokenAddressPath, pools)) {
            return [];
        }
        const [takerToken, makerToken] = tokenAddressPath;
        const sampleFunction = this.fork === ERC20BridgeSource.MStable
            ? this._sellContract.sampleSellsFromMStable
            : this._sellContract.sampleSellsFromShell;
        const samplesPerPool = await Promise.all(pools.map(async poolAddress =>
            this._sellContractHelper.ethCallAsync(
                sampleFunction,
                [
                    poolAddress,
                    takerToken,
                    makerToken,
                    takerFillAmounts,
                ],
            )
        ));
        return samplesPerPool.map((samples, i) =>
            takerFillAmounts.map((a, j) => ({
                source: this.fork,
                fillData: { poolAddress: pools[i] },
                input: a,
                output: samples[j]
            })),
        );
    }

    public async getBuyQuotesAsync(
        tokenAddressPath: Address[],
        makerFillAmounts: BigNumber[],
    ): Promise<DexSample<ShellFillData>[][]> {
        const pools = this._getPoolsForTokens(tokenAddressPath);
        if (!this.canConvertTokens(tokenAddressPath, pools)) {
            return [];
        }
        const [takerToken, makerToken] = tokenAddressPath;
        const sampleFunction = this.fork === ERC20BridgeSource.MStable
            ? this._buyContract.sampleBuysFromMStable
            : this._buyContract.sampleBuysFromShell;
        const samplesPerPool = await Promise.all(pools.map(async poolAddress =>
            this._buyContractHelper.ethCallAsync(
                sampleFunction,
                [
                    poolAddress,
                    takerToken,
                    makerToken,
                    makerFillAmounts,
                ],
            )
        ));
        return samplesPerPool.map((samples, i) =>
            makerFillAmounts.map((a, j) => ({
                source: this.fork,
                fillData: { poolAddress: pools[i] },
                input: a,
                output: samples[j]
            })),
        );
    }

    private _getPoolsForTokens(tokens: Address[]): Address[] {
        return this._pools.filter(p => tokens.every(t => p.tokens.includes(t))).map(p => p.poolAddress);
    }
}
