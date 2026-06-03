export const FILL_CAP_ENFORCER_ABI = [
  {
    "type": "constructor",
    "inputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "caps",
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
    "name": "fills",
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
        "name": "tradeId",
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
    "type": "function",
    "name": "owner",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "setCap",
    "inputs": [
      {
        "name": "subject",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "maxFills",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "setManyCaps",
    "inputs": [
      {
        "name": "subjects",
        "type": "address[]",
        "internalType": "address[]"
      },
      {
        "name": "maxFills",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "transferOwnership",
    "inputs": [
      {
        "name": "newOwner",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "event",
    "name": "CapUpdated",
    "inputs": [
      {
        "name": "subject",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "cap",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "OwnershipTransferred",
    "inputs": [
      {
        "name": "previousOwner",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "newOwner",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "PostObserved",
    "inputs": [
      {
        "name": "intentId",
        "type": "bytes32",
        "indexed": true,
        "internalType": "bytes32"
      },
      {
        "name": "tradeId",
        "type": "bytes32",
        "indexed": true,
        "internalType": "bytes32"
      },
      {
        "name": "sender",
        "type": "address",
        "indexed": false,
        "internalType": "address"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "PreCallAccepted",
    "inputs": [
      {
        "name": "intentId",
        "type": "bytes32",
        "indexed": true,
        "internalType": "bytes32"
      },
      {
        "name": "tradeId",
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
        "name": "fillNumber",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      },
      {
        "name": "cap",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      },
      {
        "name": "sender",
        "type": "address",
        "indexed": false,
        "internalType": "address"
      }
    ],
    "anonymous": false
  },
  {
    "type": "error",
    "name": "HardCapExceeded",
    "inputs": [
      {
        "name": "subject",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "cap",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "attempted",
        "type": "uint256",
        "internalType": "uint256"
      }
    ]
  },
  {
    "type": "error",
    "name": "NotOwner",
    "inputs": []
  },
  {
    "type": "error",
    "name": "ZeroAddress",
    "inputs": []
  }
] as const;
