import { ethers } from 'ethers';
import React, { useEffect, useState } from 'react';
import {
  useConnect,
  useAccount,
  useNetwork,
  useContract,
  useContractWrite,
  useProvider,
} from 'wagmi';
import { NFTABI } from '../../contracts/NFTABI';
import { MerkleTreeABI } from '../../contracts/MerkleTreeABI';

export const useIsMounted = () => {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  return mounted;
};

export default function Home() {
  const [{ data, error }, connect] = useConnect();
  const MetaMaskConnector = data.connectors[0];
  const [{ data: accountData }, disconnect] = useAccount();
  const [{ data: networkData, error: networkError, loading }, switchNetwork] =
    useNetwork();
  const isMounted = useIsMounted();
  const [numMintedNFTs, setNumMintedNFTs] = useState(0);
  const [NFTMaxSupply, setNFTMaxSupply] = useState(0);
  const [latestMerkleTreeUpdate, setLatestMerkleTreeUpdate] = useState(0);
  const provider = useProvider();

  const NFTContractAddress =
    process.env.NEXT_PUBLIC_REPUTATION_1_CONTRACT_ADDRESS;
  const MerkleTreeContractAddress =
    process.env.NEXT_PUBLIC_MERKLE_TREE_CONTRACT_ADDRESS;

  const [
    {
      data: transactionResponseData,
      error: contractError,
      loading: contractLoading,
    },
    write,
  ] = useContractWrite(
    {
      addressOrName: NFTContractAddress,
      contractInterface: NFTABI,
    },
    'safeMint',
    {
      args: ['0xF39963D2A64Fb7Bb9FC38B34A942678152E5180F'],
    }
  );

  const contractNFT = useContract({
    addressOrName: NFTContractAddress,
    contractInterface: NFTABI,
    signerOrProvider: provider,
  });

  const contractMerkleTree = useContract({
    addressOrName: MerkleTreeContractAddress,
    contractInterface: MerkleTreeABI,
    signerOrProvider: provider,
  });

  // useEffect(() => {}, [transactionResponseData]);

  async function getNumMintedNFTs() {
    contractNFT.totalSupply().then((elm) => {
      setNumMintedNFTs(elm.toString());
    });
  }

  async function getTotalSupply() {
    contractNFT.maxSupply().then((elm) => {
      setNFTMaxSupply(elm.toString());
    });
  }

  async function getLatestEvent() {
    // const eventFilter = contractMerkleTree.filters.RootChanged();
    const eventFilter = {
      address: process.env.NEXT_PUBLIC_MERKLE_TREE_CONTRACT_ADDRESS,
      topics: [ethers.utils.id('RootChanged(string,string)')],
    };
    let events = await contractMerkleTree.queryFilter(eventFilter, -1000);
    if (events.length == 0) {
      events = await contractMerkleTree.queryFilter(eventFilter, -100000);
    }

    const blockHash = events[events.length - 1].blockHash;
    provider.getBlock(blockHash).then((block) => {
      setLatestMerkleTreeUpdate(block.timestamp);
    });
  }

  useEffect(() => {
    const fetchData = async () => {
      await getNumMintedNFTs();
      await getTotalSupply();
      await getLatestEvent();
    };
    fetchData();
    provider;
  }, []);

  useEffect(() => {
    const filter = {
      address: process.env.NEXT_PUBLIC_MERKLE_TREE_CONTRACT_ADDRESS,
      topics: [ethers.utils.id('RootChanged(string,string)')],
    };
    provider.on(filter, (log) => {
      const blockHash = log.blockHash;
      provider.getBlock(blockHash).then((block) => {
        setLatestMerkleTreeUpdate(block.timestamp);
      });
    });

    provider.on('block', (block) => {
      getNumMintedNFTs();
    });

    const unsubscribe = () => {
      provider.removeAllListeners();
    };

    return unsubscribe;
  }, [provider]);

  const formatTimeStamp = (timestamp) => {
    const date = new Date(timestamp * 1000);
    if (timestamp == 0) {
      return 'not updated since last refresh';
    }
    return date.toLocaleDateString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const WalletButton = () => {
    // console.log(accountData);
    if (accountData) {
      if (networkData.chain?.id !== networkData.chains[0].id) {
        return (
          <button
            className='bg-gray-700 text-white p-2 rounded-md mt-4'
            key={networkData.chains[0].id}
            onClick={() => switchNetwork(networkData.chains[0].id)}
          >
            Switch to Harmony Testnet
          </button>
        );
      } else {
        return (
          <button
            className='bg-gray-700 text-white p-2 rounded-md mt-4'
            onClick={() => {
              write();
              // setTimeout(() => getNumMintedNFTs(), 3000);
            }}
          >
            Mint NFT
          </button>
        );
      }
    } else {
      return (
        <button
          className='bg-gray-700 text-white p-2 rounded-md mt-4'
          disabled={isMounted ? !MetaMaskConnector.ready : false}
          key={MetaMaskConnector.id}
          onClick={() => connect(MetaMaskConnector)}
        >
          {isMounted
            ? 'Connect with MetaMask'
            : MetaMaskConnector.id === 'injected'
            ? MetaMaskConnector.id
            : MetaMaskConnector.name}
          {!MetaMaskConnector.ready && '(unsupported)'}
        </button>
      );
    }
  };

  return (
    <div className='container flex p-4 mx-auto min-h-screen'>
      <main className='w-full'>
        <div className='text-center text-3xl font-mono'>Athletia</div>
        <div className='grid grid-cols-3 mt-8'>
          <div className='border-2 rounded-lg w-5/6 p-2'>
            <div className='text-2xl font-semibold text-center'>
              I. Mint an NFT
            </div>
            <div className='flex flex-col justify-between items-center'>
              <div className='mt-4'>ZKU Supporter Token</div>
              <div className='mt-4'>
                <img src='images/zku_logo.png' alt='Picture of the author' />
              </div>
              <div className='mt-4'>
                {numMintedNFTs}/{NFTMaxSupply} minted so far
              </div>
              <WalletButton />
            </div>
          </div>
          <div className='border-2 rounded-lg w-5/6 p-2'>
            <div className='text-2xl font-semibold text-center'>
              II. Wait for Merkle Tree Update
            </div>
            <div className='flex flex-col justify-between items-center w-3/4 mx-auto'>
              <div className='mt-4 text-center'>
                A Merkle Tree whose root is stored on chain keeps track of which
                wallet has the right on chain reputation. In this case the
                reputation is determined by fact if you own the ZKU Supporter
                token or not.
              </div>
              <div className='mt-4'>
                Last Update: {formatTimeStamp(latestMerkleTreeUpdate)}{' '}
              </div>
              <div className='mt-4 text-center'>
                Your NFT ownership is included in the Merkle Tree.
              </div>
            </div>
          </div>
          <div className='border-2 rounded-lg w-5/6 p-2'>
            <div className='text-2xl font-semibold text-center'>
              III. Register in Semaphore Group
            </div>

            <div className='flex flex-col justify-between items-center w-3/4 mx-auto'>
              <div className='mt-4 text-center'>
                In the last step you generate a ZKP proving that you are part of
                the Merkle, i.e. proving that you own an NFT. Now you are part
                of the Semaphore group which allows you to login on websites
                which use the membership in the Semaphore as a login method.
              </div>
              <div className='mt-4'>
                <button className='bg-gray-700 text-white p-2 rounded-md'>
                  Register in Semaphore
                </button>
              </div>
            </div>
          </div>
        </div>
        <div className='mt-16'>Supported websites:</div>
        <div>What to learn more what's happening behind the scenes?</div>
      </main>
    </div>
  );
}
