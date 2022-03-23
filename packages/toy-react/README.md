# `toy-react`

> https://github.com/pomber/didact

```ts
interface Props {
  children: Element[];
  [key: string]: any;
}

interface Element {
  type: string | (props: Props): Element;
  props: Props;
}

interface FiberNode {
  type: string | (props: Props): Element;
  props: Props;
  dom: HTMLElement | null;
  parent?: FiberNode;
  child?: FiberNode;
  sibling?: FiberNode;
  alternate: FiberNode | null;
  effectTag: 'UPDATE' | 'PLACEMENT' | 'DELETION';
}
```

1. `React.createElement` 创建 react element 对象，其中 type 表示元素类型如 div，props 为元素属性
2. `ReactDOM.render` 中为 wipRoot(FiberNode) 设置 dom、props.children、alternate，并同时赋值给 nextUnitOfWork
3. [requestIdleCallback](https://developer.mozilla.org/zh-CN/docs/Web/API/Window/requestIdleCallback) 在浏览器空闲时执行 workLoop
4. workLoop 中判断当前若浏览器空闲则将 nextUnitOfWork 传给 performUnitOfWork
    1. performUnitOfWork 接收参数 nextUnitOfWork 是一个 fiber 节点，首先根据 type 是否是函数判断是否为函数组件
    2. 函数组件执行 updateFunctionComponent
        1. 函数组件无需创建 dom，`fiber.type` 为组件的渲染函数，将返回值作为 children 执行 reconcileChildren
    3. 原生组件执行 updateHostComponent
        1. 检查若不存在 dom 则调用 createDom 创建
        2. 调用 reconcileChildren
    4. reconcileChildren 为 children 的每个元素创建 fiber node 并通过 sibling 和 child 串联链表
        1. 通过 `fiber.alternate` 拿到 oldFiber，并在下面的循环中通过 `oldFiber = oldFiber.sibling` 不断更新 oldFiber 使其与 element 保持位置同步
        2. 遍历 children，对每个 element 与 oldFiber 比较，根据 type 判断是否为相同类型
        3. 若类型相同则 newFiber 复用 oldFiber，仅更新 props，`newFiber.effectTag` 为 `UPDATE`
        4. 类型不同则创建 newFiber，此时 dom、alternate、child、sibling 都为 null，`newFiber.effectTag` 为 `PLACEMENT`
        5. 类型不同且 oldFiber 存在则将其删除，`oldFiber.effectTag` 为 `DELETION`，并将 oldFiber 推进 deletions 数组，待 commit 阶段真正删除
        6. 判断当前遍历的 element 是 children 中是否是第一个，选择挂在父节点的 child 还是前一个兄弟的 sibling
    5. 根据优先级 child、sibling、parent 查找存在的 fiber 返回作为 nextFiber
5. performUnitOfWork 返回值赋给 nextUnitOfWork，因此 workLoop 就会不断执行，直到 nextUnitOfWork 为空时开始执行 commitRoot
    1. 先遍历 deletions 对每项调用 commitWork 执行删除逻辑
    2. 将 fiber 链表的第一项 `wipRoot.child` 传给 commitWork 根据 `fiber.effectTag` 执行具体逻辑
        1. `PLACEMENT` 通过 appendChild 完成 dom 添加
        2. `UPDATE` 执行 updateDom 完成 dom 属性更新
            1. 对 prevProps 中的事件移除监听
            2. 对 prevProps 中有但 nextProps 中没有的属性置空
            3. 设置 prevProps 中的新增属性
            4. 添加 prevProps 中的事件监听
        3. `DELETION` 向下递归找到第一个有 dom 的 fiber 后通过 removeChild 删除 dom
    3. 继续将 `fiber.child` `fiber.sibling` 传给 commitWork 完成整个 fiber 树的渲染
6. useState 中通过 `wipFiber.alternate.hooks[hookIndex]` 拿到该组件上一次渲染的 fiber 上对应的 hook
    1. `hook.state` 获取到缓存的状态作为 state
    2. `hook.queue` 获取需要执行的 setState action 并遍历执行后更新 state
    3. 创建 setState 函数，内部通过重新设置 wipRoot、nextUnitOfWork 触发新的 performUnitOfWork
    4. 返回 state 及 setState
