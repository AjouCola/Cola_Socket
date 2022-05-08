import { TYPE } from "@src/type";
import { Server } from "socket.io";
import { DefaultEventsMap } from "socket.io/dist/typed-events";
import defaultMapSetting from "../utils/defaultMapSetting";

const nearByDistance = 100;

interface IUser {
  name: string;
  id: number;
  cId: number;
}

interface IUserList {
  id: number;
  socket: string;
}

interface IUserData {
  userId: number;
  roomCode: string;
  x: number;
  y: number;
  direction: string;
  state: string;
}

let RoomList: any = {};
let RoomUser: any = {};
let userSocketList: IUserList[] = [];

const createRoomCode = () => {
  while (true) {
    const code = Math.random().toString(16).substr(2, 5);
    if (!(code in Object.keys(RoomList))) return code;
  }
};

const findDefaultCharacterPosition = (mapId: number) =>
  defaultMapSetting[mapId].character;

const findSocket = (id: number) =>
  userSocketList.reduce((result: string, element: IUserList) => {
    if (element.id === id) result = element.socket;
    return result;
  }, "");

const includeUser = (list: any, user: any) => {
  if (
    user.x - nearByDistance <= list.x &&
    list.x <= user.x + nearByDistance &&
    user.y - nearByDistance <= list.y &&
    list.y <= user.y + nearByDistance
  )
    return true;
  else return false;
};

const isContain = (tempBackground: any, mapId: number) => {
  const temp = defaultMapSetting[mapId].defaultMargin;
  if (
    temp.minX <= tempBackground.top &&
    tempBackground.top <= temp.maxX &&
    temp.minY <= tempBackground.left &&
    tempBackground.left <= temp.maxY
  ) {
    return true;
  } else return false;
};

const findAdjacentUserList = (user: any, code: string) =>
  Object.keys(RoomUser[code]).reduce((result: string[], element: any) => {
    if (element !== user.id) {
      if (includeUser(RoomUser[code][element], RoomUser[code][user.id])) {
        result.push(findSocket(element));
      }
    } else result.push(findSocket(element));
    return result;
  }, []);

const getSocket = (
  socketIO: Server<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>
) => {
  socketIO.on("connect", (socket: any) => {
    console.log("socket connect");

    socket.on(
      TYPE.CREATE_ROOM,
      (
        done: (arg0: { status: string; message: string; code: string }) => void
      ) => {
        //방 Object 생성
        const code = createRoomCode();
        RoomList[code] = [];
        RoomUser[code] = {};
        done({
          status: "SUCESS",
          message: "성공적으로 방을 만들었습니다.",
          code,
        });
      }
    );

    socket.on(TYPE.JOIN_ROOM, (user: IUser, code: string) => {
      socket.join(code);
      userSocketList.push({ id: user.id, socket: socket.id });
      if (user.id) {
        RoomUser[code][user.id] = {
          name: user.name,
          x: 1800,
          y: 1800,
          direction: "down",
          state: "mid",
          cId: user.cId,
        };
        socketIO.to(code).emit("makeRoomClient", code, RoomUser[code]);
      }
    });

    socket.on(TYPE.LEAVE_ROOM, async (user: IUser, code: any) => {
      socket.leave(code);
      if (user.id) {
        try {
          delete RoomUser[code][user.id];
        } catch (e) {
          console.log(e);
        }
        socketIO.to(code).emit("makeRoomClient", code, RoomUser[code]);
        socketIO.to(code).emit("changeMove", RoomUser[code], null);
      }
    });

    socket.on(TYPE.SEND_MESSAGE, (props: any) => {
      const { user, text, room, state } = props;
      if (state === "Everyone") {
        socketIO.to(room).emit("receiveMessage", { user, text, state });
      } else if (state === "Nearby") {
        findAdjacentUserList(user, room).map((element: string) =>
          socketIO.to(element).emit("receiveMessage", { user, text, state })
        );
      } else {
        const toSocket = findSocket(state);
        const senderSocket = findSocket(user.id);
        socketIO.to(toSocket).emit("receiveMessage", { user, text, state });
        socketIO.to(senderSocket).emit("receiveMessage", { user, text, state });
      }
    });

    socket.on(TYPE.CHARACTER_MOVE, (props: any) => {
      const user: IUser = props.user;
      const code: string = props.room;
      const characterPosition: any = props.characterPosition;
      const tempBackground: any = props.tempBackground;
      if (user.id) {
        RoomUser[code][user.id] = characterPosition
          ? {
              ...characterPosition,
              name: user.name,
            }
          : {
              name: user.name,
              x: findDefaultCharacterPosition(RoomList[code]).x,
              y: findDefaultCharacterPosition(RoomList[code]).y,
              direction: "down",
              state: "mid",
              cId: user.cId,
            };
        socketIO
          .to(code)
          .emit(
            "changeMove",
            RoomUser[code],
            isContain(tempBackground, RoomList[code])
              ? tempBackground
              : undefined
          );
      }
    });

    socket.on("disconnect", () => {});
  });
};

export { getSocket };
