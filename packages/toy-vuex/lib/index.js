let Vue; // install 中获取到 Vue 后暂存

class Store {
  constructor(options = {}) {
    // 初始化 getters mutations actions
    this.getters = {};
    this._mutations = {};
    this._actions = {};
    // 给每个 module 注册 _children 属性指向子 module
    // 用于后面 installModule 中根据 _children 属性查找子 module 进行递归处理
    this._modules = new ModuleCollection(options);
    const { dispatch, commit } = this;
    // 固定 commit dispatch 的 this 指向 Store 实例
    this.commit = (type, payload) => {
      return commit.call(this, type, payload);
    };
    this.dispatch = (type, payload) => {
      return dispatch.call(this, type, payload);
    };
    // 通过 new Vue 定义响应式 state
    const state = options.state;
    this._vm = new Vue({
      data: {
        state: state,
      },
    });
    // 注册 getters  mutations actions
    // 并根据 _children 属性对子 module 递归执行 installModule
    installModule(this, state, [], this._modules.root);
  }
  // 定义 state commit dispatch
  get state() {
    return this._vm._data.state;
  }
  commit(type, payload) {
    return this._mutations[type].forEach((handler) => handler(payload));
  }
  dispatch(type, payload) {
    return this._actions[type][0](payload);
  }
}

// 从根模块开始通过 module 属性进行遍历，为所有模块添加 _children 属性
class ModuleCollection {
  constructor(rawRootModule) {
    this.register([], rawRootModule);
  }
  // 递归注册，path 是记录 module 的数组 初始为 []
  register(path, rawModule) {
    const newModule = {
      _children: {},
      _rawModule: rawModule,
      state: rawModule.state,
    };
    if (path.length === 0) {
      this.root = newModule;
    } else {
      // 非最外层路由通过 reduce 从 this.root 开始遍历找到父级路由
      const parent = path.slice(0, -1).reduce((module, key) => {
        return module._children[key];
      }, this.root);
      // 给父级路由添加 _children 属性指向该路由
      parent._children[path[path.length - 1]] = newModule;
      // 父级路由 state 中也添加该路由的 state
      Vue.set(parent.state, path[path.length - 1], newModule.state);
    }
    // 如果当前 module 还有 module 属性则遍历该属性并拼接 path 进行递归
    if (rawModule.modules) {
      forEachValue(rawModule.modules, (rawChildModule, key) => {
        this.register(path.concat(key), rawChildModule);
      });
    }
  }
}

// 从根模块开始根据 _children 遍历所有模块
function installModule(store, rootState, path, module) {
  if (path.length > 0) {
    const parentState = rootState;
    const moduleName = path[path.length - 1];
    // 所有子模块都将 state 添加到根模块的 state 上
    Vue.set(parentState, moduleName, module.state);
  }
  const context = {
    dispatch: store.dispatch,
    commit: store.commit,
  };
  // 注册 getters mutations actions
  const local = Object.defineProperties(context, {
    getters: {
      get: () => store.getters,
    },
    state: {
      get: () => {
        let state = store.state;
        return path.length
          ? path.reduce((state, key) => state[key], state)
          : state;
      },
    },
  });
  if (module._rawModule.actions) {
    forEachValue(module._rawModule.actions, (actionFn, actionName) => {
      registerAction(store, actionName, actionFn, local);
    });
  }
  if (module._rawModule.getters) {
    forEachValue(module._rawModule.getters, (getterFn, getterName) => {
      registerGetter(store, getterName, getterFn, local);
    });
  }
  if (module._rawModule.mutations) {
    forEachValue(module._rawModule.mutations, (mutationFn, mutationName) => {
      registerMutation(store, mutationName, mutationFn, local);
    });
  }
  // 根据 _children 拼接 path 并递归遍历
  forEachValue(module._children, (child, key) => {
    installModule(store, rootState, path.concat(key), child);
  });
}

// 给 store 实例的 _mutations 属性填充
function registerMutation(store, mutationName, mutationFn, local) {
  const entry =
    store._mutations[mutationName] || (store._mutations[mutationName] = []);
  entry.push((payload) => {
    mutationFn.call(store, local.state, payload);
  });
}

// 给 store 实例的 _actions 属性填充
function registerAction(store, actionName, actionFn, local) {
  const entry = store._actions[actionName] || (store._actions[actionName] = []);
  entry.push((payload) => {
    return actionFn.call(
      store,
      {
        commit: local.commit,
        state: local.state,
      },
      payload,
    );
  });
}

// 给 store 实例的 getters 属性填充
function registerGetter(store, getterName, getterFn, local) {
  Object.defineProperty(store.getters, getterName, {
    get: () => {
      return getterFn(local.state, local.getters, store.state);
    },
  });
}

// 将对象中的每一个值放入到传入的函数中作为参数执行
function forEachValue(obj, fn) {
  Object.keys(obj).forEach((key) => fn(obj[key], key));
}

// 执行 Vue.use(Vuex) 时调用 并传入 Vue 类
function install(_Vue) {
  Vue = _Vue; // 暂存 Vue 用于其他地方有用到 Vue 上的方法
  Vue.mixin({
    // 全局所有组件混入 beforeCreate 钩子，给每个组件中添加 $store 属性指向 store 实例
    beforeCreate: function vuexInit() {
      const options = this.$options;
      if (options.store) {
        // 接收参数有=中有 store 属性则为根组件
        this.$store = options.store;
      } else if (options.parent && options.parent.$store) {
        // 非根组件通过 parent 父组件获取
        this.$store = options.parent.$store;
      }
    },
  });
}

export default {
  Store,
  install,
};
