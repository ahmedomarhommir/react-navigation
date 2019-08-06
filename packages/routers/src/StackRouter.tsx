import shortid from 'shortid';
import {
  NavigationState,
  CommonAction,
  Router,
  BaseRouter,
  DefaultRouterOptions,
} from '@navigation-ex/core';

export type StackActionType =
  | {
      type: 'PUSH';
      payload: { name: string; params?: object };
      source?: string;
    }
  | {
      type: 'POP';
      payload: { count: number };
      source?: string;
    }
  | { type: 'POP_TO_TOP'; source?: string };

export type StackRouterOptions = DefaultRouterOptions;

export type StackNavigationState = NavigationState;

export const StackActions = {
  push(name: string, params?: object): StackActionType {
    return { type: 'PUSH', payload: { name, params } };
  },
  pop(count: number = 1): StackActionType {
    return { type: 'POP', payload: { count } };
  },
  popToTop(): StackActionType {
    return { type: 'POP_TO_TOP' };
  },
};

export default function StackRouter(options: StackRouterOptions) {
  const router: Router<StackNavigationState, CommonAction | StackActionType> = {
    ...BaseRouter,

    getInitialState({ routeNames, routeParamList }) {
      const index =
        options.initialRouteName === undefined
          ? 0
          : routeNames.indexOf(options.initialRouteName);

      return {
        key: `stack-${shortid()}`,
        index,
        routeNames,
        routes: routeNames.slice(0, index + 1).map(name => ({
          name,
          key: `${name}-${shortid()}`,
          params: routeParamList[name],
        })),
      };
    },

    getRehydratedState({ routeNames, partialState }) {
      let state = partialState;

      if (state.stale) {
        state = {
          ...state,
          stale: false,
          routeNames,
          key: `stack-${shortid()}`,
        };
      }

      return state;
    },

    getStateForRouteNamesChange(state, { routeNames }) {
      const routes = state.routes.filter(route =>
        routeNames.includes(route.name)
      );

      return {
        ...state,
        routeNames,
        routes,
        index: Math.min(state.index, routes.length - 1),
      };
    },

    getStateForRouteFocus(state, key) {
      const index = state.routes.findIndex(r => r.key === key);

      if (index === -1 || index === state.index) {
        return state;
      }

      return {
        ...state,
        index,
        routes: state.routes.slice(0, index + 1),
      };
    },

    getStateForAction(state, action) {
      switch (action.type) {
        case 'PUSH':
          if (state.routeNames.includes(action.payload.name)) {
            return {
              ...state,
              index: state.index + 1,
              routes: [
                ...state.routes,
                {
                  key: `${action.payload.name}-${shortid()}`,
                  name: action.payload.name,
                  params: action.payload.params,
                },
              ],
            };
          }

          return null;

        case 'POP':
          {
            const index = action.source
              ? state.routes.findIndex(r => r.key === action.source)
              : state.routes.length - 1;

            if (state.index > 0 && index > -1) {
              return {
                ...state,
                index: state.index - 1,
                routes: state.routes.slice(
                  0,
                  Math.max(index - action.payload.count + 1, 1)
                ),
              };
            }
          }

          return null;

        case 'POP_TO_TOP':
          return router.getStateForAction(state, {
            type: 'POP',
            payload: { count: state.routes.length - 1 },
            source: action.source,
          });

        case 'NAVIGATE':
          if (
            action.payload.key ||
            (action.payload.name &&
              state.routeNames.includes(action.payload.name))
          ) {
            // If the route already exists, navigate to that
            let index = -1;

            if (
              state.routes[state.index].name === action.payload.name ||
              state.routes[state.index].key === action.payload.key
            ) {
              index = state.index;
            } else {
              for (let i = state.routes.length - 1; i >= 0; i--) {
                if (
                  state.routes[i].name === action.payload.name ||
                  state.routes[i].key === action.payload.key
                ) {
                  index = i;
                  break;
                }
              }
            }

            if (index === -1 && action.payload.key) {
              return null;
            }

            if (index === -1 && action.payload.name !== undefined) {
              return router.getStateForAction(state, {
                type: 'PUSH',
                payload: {
                  name: action.payload.name,
                  params: action.payload.params,
                },
                source: action.source,
              });
            }

            return {
              ...state,
              index,
              routes: [
                ...state.routes.slice(0, index),
                action.payload.params !== undefined
                  ? {
                      ...state.routes[index],
                      params: {
                        ...state.routes[index].params,
                        ...action.payload.params,
                      },
                    }
                  : state.routes[index],
              ],
            };
          }
          return null;

        case 'GO_BACK':
          return router.getStateForAction(state, {
            type: 'POP',
            payload: { count: 1 },
            source: action.source,
          });

        default:
          return BaseRouter.getStateForAction(state, action);
      }
    },

    actionCreators: StackActions,
  };

  return router;
}