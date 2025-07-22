*Virtual Disk Management System:   

*Overview:
This project is a Virtual Disk Management System implemented in C. It simulates a file system where users can create, update, delete, and read files within a virtual disk. The system operates on Linux and is designed for efficient file handling.

*Features

1.File Addition: Add files to the virtual disk while encoding file names and sizes.

2.File Retrieval: Retrieve files from the virtual disk based on file metadata.

3.File Listing: List all files stored in the virtual disk with their sizes.

4.Virtual Disk Creation: Initialize a new virtual disk for file storage.

*Build System

The project uses a Makefile for efficient compilation and management of dependencies.

*Makefile Targets

-all: Compiles all executables (create_vd, vd_add, vd_get, vd_ls).

-create_vd: Creates the virtual disk.

-vd_add: Adds a file to the virtual disk.

-vd_get: Retrieves a file from the virtual disk.

-vd_ls: Lists all files in the virtual disk.

-clean: Removes all compiled files and object files.

*Compilation Commands

-Each .o file is compiled using gcc -c.

-The archive arc.a is created with ar rcs.

-Final executables are linked using gcc.

*Code Structure

1.create_vd.c

  -Initializes a new virtual disk file and prepares it for use. It sets up metadata for file storage.

2.vd_add.c

Adds a file to the virtual disk:

-Opens the virtual disk and the input file.

-Encodes file name and size using encode function.

-Appends file data to the virtual disk while updating metadata.

3.vd_get.c

Retrieves a file from the virtual disk:

-Reads metadata to locate the file.

-Decodes file name and size using decode_file function.

-Extracts the file content and writes it to an output file.

4.vd_ls.c

Lists all files in the virtual disk:

-Decodes metadata to display file names and sizes.

5.encode.c

Encodes file names and metadata for storage in the virtual disk.

6.decode_file.c

Decodes metadata to retrieve file names and sizes.

*Usage

Build the Project:

Run the following command to compile all components:

    :=  make all
	
-Create a Virtual Disk
     :=  ./create_vd <disk_name>
    
-Add a File

   := ./vd_add <disk_name> <file_path>
   
-Retrieve a File

  :=  ./vd_get <disk_name> <file_index> <output_file>
  
-Retrieve a File

   :=  ./vd_get <disk_name> <file_index> <output_file>
    
-Retrieve a File

   := ./vd_get <disk_name> <file_index> <output_file>
   
-Clean Build Artifacts

   := make clean
