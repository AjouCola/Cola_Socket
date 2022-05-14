import { MESSAGE } from "@src/constant";
import { TYPE } from "@src/type";
import { Server, Socket } from "socket.io";
import { DefaultEventsMap } from "socket.io/dist/typed-events";
import defaultMapSetting from "../utils/defaultMapSetting";

const nearByDistance = 100;
const GATHER_ROOM_CODE: string = "ajou-gather";
interface IUser {
  name: string;
  id: string;
  cId: number;
}

interface IUserList {
  id: string;
  socket: string;
}
interface IChat {
  status: string;
  text: string;
  name: string;
  cId: number;
  date: number;
  id: string;
}
interface IUserData {
  name: string;
  cId: number;
  x: number;
  y: number;
  direction: string;
  state: string;
}

let RoomList: any = {};
let RoomUser: any = {};
let userSocketList: IUserList[] = [];

RoomList[GATHER_ROOM_CODE] = 0;
RoomUser[GATHER_ROOM_CODE] = {};

const createRoomCode = () => {
  while (true) {
    const code = Math.random().toString(16).substr(2, 5);
    if (!(code in Object.keys(RoomList))) return code;
  }
};

const createUserInfo =
  (name: string) => (x: number, y: number) => (cId: number) => ({
    name,
    x,
    y,
    direction: "down",
    state: "mid",
    cId,
  });

const findDefaultCharacterPosition = (mapId: number) =>
  defaultMapSetting[mapId].character;

const findSocket = (id: string) =>
  userSocketList.reduce(
    (result: string, element: IUserList) =>
      element.id === id ? element.socket : result,
    ""
  );

const includeUser = (list: any, user: any) =>
  user.x - nearByDistance <= list.x &&
  list.x <= user.x + nearByDistance &&
  user.y - nearByDistance <= list.y &&
  list.y <= user.y + nearByDistance;

const isContain = (tempBackground: any, mapId: number) => {
  const temp = defaultMapSetting[mapId].defaultMargin;
  return (
    temp.minX <= tempBackground.top &&
    tempBackground.top <= temp.maxX &&
    temp.minY <= tempBackground.left &&
    tempBackground.left <= temp.maxY
  );
};

const findAdjacentUserList = (user: IUser, code: string) =>
  Object.entries(RoomUser[code]).reduce((result: string[], [keys, room]) => {
    if (keys !== user.id) {
      if (includeUser(room, user)) {
        result.push(findSocket(keys));
      }
    } else result.push(findSocket(keys));
    return result;
  }, []);

const getSocket = (
  socketIO: Server<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>
) => {
  socketIO.on("connect", (socket: Socket) => {
    console.log("socket connect", socket.id);

    socket.on(
      TYPE.CREATE_ROOM,
      (
        done: (arg0: { status: string; message: string; code: string }) => void
      ) => {
        const code = GATHER_ROOM_CODE;
        if (RoomList[code] !== undefined)
          done({ status: "FAILED", message: MESSAGE.EXIST, code });
        else {
          RoomList[code] = 0;
          RoomUser[code] = {};
          done({
            status: "SUCESS",
            message: MESSAGE.CREATE,
            code,
          });
        }
      }
    );

    socket.on(
      TYPE.JOIN_ROOM,
      (user: IUser, code: string, done: (userData: IUserData) => void) => {
        const { id, name, cId } = user;
        if (!id) return;

        socket.join(code);
        userSocketList.push({ id, socket: socket.id });
        RoomUser[code][id] = createUserInfo(name)(1800, 1800)(cId);
        done(createUserInfo(name)(1800, 1800)(cId));
        socketIO.to(code).emit("makeRoomClient", code, RoomUser[code]);
      }
    );

    socket.on(TYPE.LEAVE_ROOM, async (user: IUser, code: any) => {
      socket.leave(code);
      if (!user.id) return;
      try {
        delete RoomUser[code][user.id];
      } catch (e) {
        console.log(e);
      }
      socketIO.to(code).emit("makeRoomClient", code, RoomUser[code]);
      socketIO.to(code).emit("changeMove", RoomUser[code], null);
    });

    socket.on(TYPE.CHARACTER_MOVE, (props: any) => {
      if (!socket.id) return;
      const { user, code, tempBackground } = props;
      const { x, y } = findDefaultCharacterPosition(RoomList[code]);
      RoomUser[code][socket.id] = user
        ? user
        : createUserInfo(user.name)(x, y)(user.cId);
      socketIO
        .to(code)
        .emit(
          "changeMove",
          RoomUser[code],
          isContain(tempBackground, RoomList[code]) ? tempBackground : undefined
        );
    });

    socket.on(TYPE.SEND_MESSAGE, (chat: IChat) => {
      const { status } = chat;
      const room = RoomUser[GATHER_ROOM_CODE][socket.id];

      if (status === "Everyone")
        socket.broadcast.emit(TYPE.RECEIVE_MESSAGE, chat);
      else if (status === "Nearby")
        findAdjacentUserList(room, GATHER_ROOM_CODE).map((user: string) =>
          socketIO.to(user).emit(TYPE.RECEIVE_MESSAGE, chat)
        );
      else socket.to(status).emit(TYPE.RECEIVE_MESSAGE, chat);
    });

    socket.on("disconnect", () => {
      console.log("disconnect", socket.id);
    });
  });
};

export { getSocket };
