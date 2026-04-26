import {
  getDriveConfig,
  listDirectChildFolders,
  type DriveClient,
} from "../clients/google-drive-client.ts";

export const getDriveBranches = async (drive: DriveClient) => {
  const { driveRootFolderId } = getDriveConfig();
  const folders = await listDirectChildFolders(drive, driveRootFolderId);

  return {
    branches: folders.map((folder) => ({ name: folder.name })),
  };
};
