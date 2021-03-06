import Vue from 'vue';
import Vuex from 'vuex';
import {
  State,
  ActionContext,
  User,
  World,
  CombatHub,
  CombatRoom,
} from './types';

import io from 'socket.io-client';
import api from '@/api';
import moment from 'moment';

Vue.use(Vuex);

const initialState = {
  headerVisibility: true,
  user: {
    id: null,
    username: '',
    gold: 0,
    role: '',
    level: 0,
    authenticated: false,
    currentJWT: '',
    createdAt: '',
    token: null,
    isAdmin: false,
    xp: 0,
    nextLevelXp: 200,
  },
  world: {
    timeOfDay: 0,
    connectedUsers: {},
    inCombat: 0,
  },
  combatHub: {
    rooms: {},
  },
  combatGame: {
    gameState: {
      id: '',
      title: '',
      playerCount: 0,
      maxPlayers: 4,
      players: {},
      enemies: {},
      turn: -1,
      level: 0,
      queuedEvents: [],
      turnEvents: {},
      playState: 1,
      readyToContinue: {},
      levelRecord: {},
    },
    selectionMode: 'ACTION',
  },
  socket: {
    connected: false,
    loading: false,
    room: null,
  },
};

const state: State = {...initialState};

const mutations = {
  SET_HEADER_VISIBILITY(s: State, b: boolean) {
    s.headerVisibility = b;
  },
  /*
    Socket events
  */
  SET_SOCKET_CONNECTION(s: State, state: boolean) {
    s.socket.loading = false;
    s.socket.connected = state;
  },
  SET_SOCKET_LOADING(s: State) {
    s.socket.loading = true;
  },
  UPDATE_SOCKET_USER(s: State, user: User) {
    s.user = {
      ...s.user,
      ...user,
    };
  },
  SET_SOCKET_ROOM(s: State, room: any) {
    s.socket.room = room;
  },
  UPDATE_WORLD_STATE(s: State, worldState: World) {
    s.world = { ...s.world, ...worldState };
  },
  UPDATE_COMBAT_HUB_STATE(s: State, combatHubState: CombatHub) {
    s.combatHub = { ...s.combatHub, ...combatHubState };
  },
  RESET_GAME_STATE(s: State, name: string) {
    switch (name) {
      case 'COMBAT_ROOM':
        s.combatGame = { ...initialState.combatGame };
        break;
      default:
        return;
    }
  },
  SET_COMBAT_GAME_STATE(s: State, combatRoomState: CombatRoom) {
    s.combatGame.gameState = { ...s.combatGame.gameState, ...combatRoomState };
  },
  SET_COMBAT_GAME_SELECTION_MODE(s: State, selectionMode: string) {
    s.combatGame.selectionMode = selectionMode;
  },
};

const socket = io(`${api.getBaseURL()}/game`, { autoConnect: false });

const actions = {
  OPEN_SOCKET({ commit, dispatch }: ActionContext) {
    socket.open();
    /*
      Socket events
    */
    socket.on('connect', () => {
      commit('SET_SOCKET_CONNECTION', true);
      dispatch('INIT_SOCKET');
    });
    socket.on('disconnect', () => {
      commit('SET_SOCKET_CONNECTION', false);
      commit('UPDATE_SOCKET_USER', { authenticated: false, id: null, currentJWT: '' });
    });
    socket.on('connect_error', () => {
      commit('SET_SOCKET_CONNECTION', false);
    });
    socket.on('reconnect_attempt', () => {
      commit('SET_SOCKET_LOADING', true);
    });
    socket.on('reconnect_error', () => {
      commit('SET_SOCKET_CONNECTION', false);
    });

    /*
      Server events
    */
    socket.on('WORLD_STATE', (worldState: World) => {
      commit('UPDATE_WORLD_STATE', worldState);
    });
    socket.on('COMBAT_HUB_STATE', (combatHubState: CombatHub) => {
      commit('UPDATE_COMBAT_HUB_STATE', combatHubState);
    });
    socket.on('USER_STATE', (user: User) => {
      commit('UPDATE_SOCKET_USER', user);
    });
    socket.on('COMBAT_ROOM_STATE', (combatRoomState: CombatRoom) => {
      commit('SET_COMBAT_GAME_STATE', combatRoomState);
    });
  },
  INIT_SOCKET({ commit }: ActionContext) {
    /*
      Authenticate socket
    */
    const JWT = localStorage.getItem('grandquest:jwt');
    if (JWT) {
      socket.emit('AUTHENTICATE_SOCKET', JWT, (err: string | null, user?: User) => {
        if (!err && user) {
          commit('UPDATE_SOCKET_USER', { ...user, authenticated: true, currentJWT: JWT });
        } else {
          commit('UPDATE_SOCKET_USER', { ...user, authenticated: false, currentJWT: '' });
          localStorage.removeItem('grandquest:jwt');
        }
      });
    }
  },
  SOCKET_EMIT(ac: any, params: [string, ...any[]]) {
    if (params.length === 0) {
      return;
    }
    socket.emit(...params);
  },
  socketLeaveRoom({ commit }: ActionContext, room: string) {
    if (!socket.connected) { console.warn('vuex > socketLeaveRoom > "Attempted to leave room before socket connected"'); }

    socket.emit(`${room.toUpperCase()}_LEAVE`);
    commit(`SET_SOCKET_ROOM`, null);
  },
};

export default new Vuex.Store({
  state,
  mutations,
  actions,
});
