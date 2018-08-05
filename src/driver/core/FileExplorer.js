import DOMHelper from '../../utils/DOMHelper'
import treeParser from '../../utils/treeParser'
import URLHelper from '../../utils/URLHelper'
import VisibleNodesGenerator from '../../utils/VisibleNodesGenerator'

function getVisibleParentNode(nodes, focusedNode, depths) {
  const focusedNodeIndex = nodes.indexOf(focusedNode)
  const focusedNodeDepth = depths.get(focusedNode)
  let indexOfParentNode = focusedNodeIndex - 1
  while (
    indexOfParentNode !== -1 &&
    depths.get(nodes[indexOfParentNode]) >= focusedNodeDepth
  ) {
    --indexOfParentNode
  }
  const parentNode = nodes[indexOfParentNode]
  return parentNode
}

const tasksAfterRender = []
const visibleNodesGenerator = new VisibleNodesGenerator()

const init = dispatch => () => dispatch(async (state, { treeData, metaData, compressSingletonFolder }) => {
  const { root } = treeParser.parse(treeData, metaData)
  visibleNodesGenerator.setCompress(compressSingletonFolder)
  await visibleNodesGenerator.plantTree(root)
  const currentPath = URLHelper.getCurrentPath(true)
  if (currentPath.length) {
    const nodeExpandedTo = visibleNodesGenerator.expandTo(currentPath.join('/'))
    if (nodeExpandedTo) {
      visibleNodesGenerator.focusNode(nodeExpandedTo)
      const { nodes } = visibleNodesGenerator.visibleNodes
      tasksAfterRender.push(() => DOMHelper.scrollToNodeElement(nodes.indexOf(nodeExpandedTo)))
    }
  }
  tasksAfterRender.push(DOMHelper.focusSearchInput)
  dispatch(updateVisibleNodes)
})

const execAfterRender = dispatch => () => {
  for (const task of tasksAfterRender) {
    task()
  }
  tasksAfterRender.length = 0
}

const handleKeyDown = dispatch => ({ key }) => dispatch(({ visibleNodes: { nodes, focusedNode, expandedNodes, depths } }) => {
  if (focusedNode) {
    const focusedNodeIndex = nodes.indexOf(focusedNode)
    switch (key) {
      case 'ArrowUp':
        // focus on previous node
        if (focusedNodeIndex === 0) {
          dispatch(focusNode, nodes[nodes.length - 1])
        } else {
          dispatch(focusNode, nodes[focusedNodeIndex - 1])
        }
        break

      case 'ArrowDown':
        // focus on next node
        if (focusedNodeIndex + 1 < nodes.length) {
          dispatch(focusNode, nodes[focusedNodeIndex + 1])
        } else {
          dispatch(focusNode, nodes[0])
        }
        break

      case 'ArrowLeft':
        // collapse node or go to parent node
        if (expandedNodes.has(focusedNode)) {
          dispatch(setExpand, focusedNode, false)
        } else {
          // go forward to the start of the list, find the closest node with lower depth
          const parentNode = getVisibleParentNode(nodes, focusedNode, depths)
          if (parentNode) {
            dispatch(focusNode, parentNode)
          }
        }
        break

      // consider the two keys as 'confirm' key
      case 'ArrowRight':
        // expand node or focus on first content node or redirect to file page
        if (focusedNode.type === 'tree') {
          if (expandedNodes.has(focusedNode)) {
            const nextNode = nodes[focusedNodeIndex + 1]
            if (depths.get(nextNode) > depths.get(focusedNode)) {
              dispatch(focusNode, nextNode)
            }
          } else {
            dispatch(setExpand, focusedNode, true)
          }
        } else if (focusedNode.type === 'blob') {
          DOMHelper.loadWithPJAX(focusedNode.url)
        } else if (focusedNode.type === 'commit') {
          // redirect to its parent folder
          DOMHelper.loadWithPJAX(focusedNode.parent.url)
        }
        break
      case 'Enter':
        // expand node or redirect to file page
        if (focusedNode.type === 'tree') {
          dispatch(setExpand, focusedNode, true)
        } else if (focusedNode.type === 'blob') {
          DOMHelper.loadWithPJAX(focusedNode.url)
        } else if (focusedNode.type === 'commit') {
          // redirect to its parent folder
          DOMHelper.loadWithPJAX(focusedNode.parent.url)
        }
        break

    }
  } else {
    // now search input is focused
    if (nodes.length) {
      switch (key) {
        case 'ArrowDown':
          dispatch(focusNode, nodes[0])
          break
        case 'ArrowUp':
          dispatch(focusNode, nodes[nodes.length - 1])
          break
      }
    }
  }
})

const handleSearchKeyChange = dispatch => async event => {
  const searchKey = event.target.value
  await visibleNodesGenerator.search(searchKey)
  dispatch(updateVisibleNodes)
}

const setExpand = dispatch => (node, expand) => {
  visibleNodesGenerator.setExpand(node, expand)
  dispatch(focusNode, node)
  tasksAfterRender.push(DOMHelper.focusSearchInput)
}

const toggleNodeExpansion = dispatch => (node, skipScrollToNode) => {
  visibleNodesGenerator.toggleExpand(node)
  dispatch(focusNode, node, skipScrollToNode)
  tasksAfterRender.push(DOMHelper.focusFileExplorer)
}

const focusNode = dispatch => (node, skipScroll) => dispatch(({ visibleNodes: { nodes } }) => {
  visibleNodesGenerator.focusNode(node)
  if (node && !skipScroll) {
    // when focus a node not in viewport(by keyboard), scroll to it
    const indexOfToBeFocusedNode = nodes.indexOf(node)
    tasksAfterRender.push(() => DOMHelper.scrollToNodeElement(indexOfToBeFocusedNode))
    tasksAfterRender.push(DOMHelper.focusSearchInput)
  }
  dispatch(updateVisibleNodes)
})

const onNodeClick = dispatch => (node) => {
  if (node.type === 'tree') {
    dispatch(toggleNodeExpansion, node, true)
  } else if (node.type === 'blob') {
    dispatch(focusNode, node, true)
    DOMHelper.loadWithPJAX(node.url)
  } else if (node.type === 'commit') {
    DOMHelper.loadWithPJAX(node.parent.url)
  }
}

const updateVisibleNodes = dispatch => () => {
  const { visibleNodes } = visibleNodesGenerator
  dispatch({ visibleNodes })
}

export default {
  init,
  execAfterRender,
  handleKeyDown,
  handleSearchKeyChange,
  setExpand,
  toggleNodeExpansion,
  focusNode,
  onNodeClick,
  updateVisibleNodes,
}