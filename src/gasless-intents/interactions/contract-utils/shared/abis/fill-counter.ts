export const FILL_COUNTER_ABI = [
  {
    "type": "function",
    "name": "decodePayload",
    "inputs": [
      {
        "name": "hookPayload",
        "type": "bytes",
        "internalType": "bytes"
      }
    ],
    "outputs": [
      {
        "name": "subject",
        "type": "address",
        "internalType": "address"
      }
    ],
    "stateMutability": "pure"
  },
  {
    "type": "function",
    "name": "getStats",
    "inputs": [
      {
        "name": "subject",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [
      {
        "name": "fills",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "giveTotal",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "intentFillCount",
    "inputs": [
      {
        "name": "",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "lifetimeFills",
    "inputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "lifetimeGiveAmount",
    "inputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "lifetimeGiveAmountByToken",
    "inputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "onPostCallForCrossChainIntent",
    "inputs": [
      {
        "name": "ctx",
        "type": "tuple",
        "internalType": "struct IPostInteractionHook.CrossChainContext",
        "components": [
          {
            "name": "intentId",
            "type": "bytes32",
            "internalType": "bytes32"
          },
          {
            "name": "tradeId",
            "type": "bytes32",
            "internalType": "bytes32"
          },
          {
            "name": "payload",
            "type": "bytes",
            "internalType": "bytes"
          },
          {
            "name": "giveToken",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "giveAmount",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "takeToken",
            "type": "bytes",
            "internalType": "bytes"
          },
          {
            "name": "takeAmount",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "takeChainId",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "takeChainReceiver",
            "type": "bytes",
            "internalType": "bytes"
          }
        ]
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "onPostCallForCrossChainIntentWithPreSwap",
    "inputs": [
      {
        "name": "ctx",
        "type": "tuple",
        "internalType": "struct IPostInteractionHook.CrossChainWithPreSwapContext",
        "components": [
          {
            "name": "intentId",
            "type": "bytes32",
            "internalType": "bytes32"
          },
          {
            "name": "tradeId",
            "type": "bytes32",
            "internalType": "bytes32"
          },
          {
            "name": "payload",
            "type": "bytes",
            "internalType": "bytes"
          },
          {
            "name": "preSwapResults",
            "type": "tuple[]",
            "internalType": "struct IPreSwapResult.PreSwapResult[]",
            "components": [
              {
                "name": "inputToken",
                "type": "address",
                "internalType": "address"
              },
              {
                "name": "inputAmount",
                "type": "uint256",
                "internalType": "uint256"
              },
              {
                "name": "outputAmount",
                "type": "uint256",
                "internalType": "uint256"
              }
            ]
          },
          {
            "name": "giveToken",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "giveAmount",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "takeToken",
            "type": "bytes",
            "internalType": "bytes"
          },
          {
            "name": "takeAmount",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "takeChainId",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "takeChainReceiver",
            "type": "bytes",
            "internalType": "bytes"
          }
        ]
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "onPostCallForSameChainIntentWithPreSwap",
    "inputs": [
      {
        "name": "ctx",
        "type": "tuple",
        "internalType": "struct IPostInteractionHook.SameChainWithPreSwapChainContext",
        "components": [
          {
            "name": "intentId",
            "type": "bytes32",
            "internalType": "bytes32"
          },
          {
            "name": "tradeId",
            "type": "bytes32",
            "internalType": "bytes32"
          },
          {
            "name": "payload",
            "type": "bytes",
            "internalType": "bytes"
          },
          {
            "name": "preSwapResults",
            "type": "tuple[]",
            "internalType": "struct IPreSwapResult.PreSwapResult[]",
            "components": [
              {
                "name": "inputToken",
                "type": "address",
                "internalType": "address"
              },
              {
                "name": "inputAmount",
                "type": "uint256",
                "internalType": "uint256"
              },
              {
                "name": "outputAmount",
                "type": "uint256",
                "internalType": "uint256"
              }
            ]
          },
          {
            "name": "takeToken",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "takeAmountAfterFeeCharge",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "receiver",
            "type": "address",
            "internalType": "address"
          }
        ]
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "onPreCall",
    "inputs": [
      {
        "name": "intentId",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "hookPayload",
        "type": "bytes",
        "internalType": "bytes"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "event",
    "name": "FillRecorded",
    "inputs": [
      {
        "name": "intentId",
        "type": "bytes32",
        "indexed": true,
        "internalType": "bytes32"
      },
      {
        "name": "subject",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "token",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "intentFillNumber",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      },
      {
        "name": "lifetimeFills",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      },
      {
        "name": "lifetimeGiveAmount",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      },
      {
        "name": "lifetimeTokenAmount",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      },
      {
        "name": "amountAdded",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      }
    ],
    "anonymous": false
  }
] as const;
